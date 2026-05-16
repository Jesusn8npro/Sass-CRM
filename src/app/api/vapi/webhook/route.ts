import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarLead,
  actualizarLlamadaPorCallId,
  guardarContactosEmail,
  guardarContactosTelefono,
  insertarMensaje,
  marcarLeadImportado,
  obtenerCuenta,
  obtenerCuentaPorAssistantId,
  obtenerLlamadaPorCallId,
  obtenerOCrearConversacion,
  registrarUso,
  type EstadoLead,
  type EstadoLlamada,
} from "@/lib/baseDatos";
import { verificarSecretWebhook } from "@/lib/vapi";
import { dispararWebhook } from "@/lib/webhooks";
import {
  actualizarRegistroLlamadaPorVapiId,
  obtenerRegistroLlamadaPorVapiId,
} from "@/lib/db/outreachLogs";
import {
  actualizarEstadoProspeccion,
  obtenerLead,
  registrarFalloProspeccion,
  sincronizarDatosCapturadosAlLead,
} from "@/lib/db/leadsExtraidos";

export const dynamic = "force-dynamic";

// ============================================================
// Tipos de payload Vapi
// ============================================================

interface VapiWebhookCall {
  id?: string;
  assistantId?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  customer?: { number?: string; name?: string };
}

interface VapiWebhookMessage {
  type?: string;
  call?: VapiWebhookCall;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    // Nuevo Vapi Structured Outputs
    structuredOutputs?: Record<string, { result?: Record<string, unknown> }>;
  };
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
  };
}

interface VapiWebhookBody {
  message?: VapiWebhookMessage;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Extrae structuredData desde AMBAS ubicaciones posibles en el payload de Vapi:
 * - message.analysis.structuredData  (analysisPlan — legacy + actual)
 * - message.artifact.structuredOutputs  (nuevo Structured Outputs de Vapi)
 * Devuelve el primero que tenga datos, o null si no hay ninguno.
 */
function extraerDatosEstructurados(
  message: VapiWebhookMessage,
): Record<string, unknown> | null {
  // Ruta 1: analysisPlan (la que usamos nosotros)
  const sd = message.analysis?.structuredData;
  if (sd && typeof sd === "object" && Object.keys(sd).length > 0) return sd;

  // Ruta 2: nuevo Structured Outputs de Vapi
  const so = message.artifact?.structuredOutputs;
  if (so && typeof so === "object") {
    const merged: Record<string, unknown> = {};
    for (const val of Object.values(so)) {
      if (val?.result && typeof val.result === "object") {
        Object.assign(merged, val.result);
      }
    }
    if (Object.keys(merged).length > 0) return merged;
  }

  return null;
}

function calcularDuracion(message: VapiWebhookMessage): number | null {
  const inicio = message.call?.startedAt ? new Date(message.call.startedAt).getTime() : null;
  const fin = message.call?.endedAt ? new Date(message.call.endedAt).getTime() : null;
  return inicio && fin ? Math.max(0, Math.floor((fin - inicio) / 1000)) : null;
}

/** Mapea el nivel de interés extraído por Vapi al estado del lead en CRM. */
function nivelInteresAEstadoLead(nivel: unknown, reunionAgendada: unknown): EstadoLead {
  if (reunionAgendada === true) return "negociacion";
  if (nivel === "alto") return "interesado";
  if (nivel === "medio" || nivel === "bajo") return "contactado";
  if (nivel === "sin_interes") return "perdido";
  return "contactado";
}

function mapearEstado(
  estadoVapi: string | undefined,
  endedReason: string | undefined,
): EstadoLlamada {
  if (estadoVapi === "queued" || estadoVapi === "ringing") return "sonando";
  if (estadoVapi === "in-progress" || estadoVapi === "forwarding") return "en_curso";
  if (estadoVapi === "ended") {
    if (
      endedReason === "customer-did-not-answer" ||
      endedReason === "voicemail" ||
      endedReason === "no-answer"
    ) return "sin_respuesta";
    if (endedReason?.includes("error")) return "fallida";
    return "completada";
  }
  return "iniciando";
}

// ============================================================
// Handler: llamada de OUTREACH (existe en prospeccion_llamadas)
// ============================================================

import type { RegistroLlamadaProspeccion } from "@/lib/db/outreachLogs";

const RESULTADOS_COMPLETADO = new Set([
  "customer-ended-call",
  "assistant-ended-call",
  "pipeline-error-openai-voice-failed",
  "silence-timed-out",
  "assistant-said-end-call-phrase",
]);

async function manejarWebhookOutreach(
  message: VapiWebhookMessage,
  callId: string,
  logOutreach: RegistroLlamadaProspeccion,
): Promise<NextResponse> {
  const tipo = message.type ?? "";

  if (tipo !== "end-of-call-report") {
    return NextResponse.json({ ok: true, tipo: "outreach-status" });
  }

  const transcript = message.transcript ?? message.artifact?.transcript ?? null;
  const urlGrabacion = message.recordingUrl ?? message.artifact?.recordingUrl ?? null;
  const resumen = message.summary ?? message.analysis?.summary ?? null;
  const endedReason = message.call?.endedReason ?? "";
  const datosCapturados = extraerDatosEstructurados(message);
  const duracion = calcularDuracion(message);

  await actualizarRegistroLlamadaPorVapiId(callId, {
    resultado: endedReason || "completada",
    transcripcion: transcript,
    url_grabacion: urlGrabacion,
    duracion_segundos: duracion,
    costo_usd: typeof message.call?.cost === "number" ? message.call.cost : null,
    resumen,
    datos_capturados: datosCapturados,
  });

  const lead = await obtenerLead(logOutreach.lead_id);
  if (!lead) return NextResponse.json({ ok: true, tipo: "outreach" });

  const esCompletado =
    RESULTADOS_COMPLETADO.has(endedReason) ||
    (!!transcript && transcript.length > 50);

  const dc = (datosCapturados && typeof datosCapturados === "object")
    ? datosCapturados as Record<string, unknown>
    : null;

  if (esCompletado) {
    await actualizarEstadoProspeccion(lead.id, "completado");

    const nombreCapturado = dc && typeof dc.nombre_contacto === "string" ? dc.nombre_contacto : null;
    const emailCapturado = dc && typeof dc.email === "string" ? dc.email : null;
    const emailFinal = emailCapturado ?? lead.email ?? null;
    const nombreFinal = nombreCapturado ?? lead.nombre;

    if (dc) {
      void sincronizarDatosCapturadosAlLead(lead.id, {
        email: emailFinal,
        nombre_contacto: nombreCapturado,
      });
    }

    let convId = lead.conversacion_id ?? null;
    try {
      const telefono =
        lead.telefono ||
        (emailFinal
          ? `mail_${emailFinal.split("@")[0]}_${lead.id.slice(0, 6)}`
          : `lead_${lead.id.slice(0, 8)}`);

      const conv = await obtenerOCrearConversacion(lead.cuenta_id, telefono, nombreFinal, null);
      convId = conv.id;

      if (emailFinal) await guardarContactosEmail(lead.cuenta_id, conv.id, [emailFinal]);
      if (lead.telefono) await guardarContactosTelefono(lead.cuenta_id, conv.id, [lead.telefono], telefono);
      if (!lead.importado || !lead.conversacion_id) await marcarLeadImportado(lead.id, conv.id);
    } catch (err) {
      console.error("[vapi-webhook] ✗ Error resolviendo conversación CRM:", err);
    }

    if (convId && dc) {
      try {
        const estadoLead = nivelInteresAEstadoLead(dc.nivel_interes, dc.reunion_agendada);
        const otrosCampos: Record<string, string> = {};
        if (typeof dc.objecion_principal === "string" && dc.objecion_principal)
          otrosCampos.objecion = dc.objecion_principal;
        if (typeof dc.proximo_paso === "string" && dc.proximo_paso)
          otrosCampos.proximo_paso = dc.proximo_paso;
        if (typeof dc.notas === "string" && dc.notas)
          otrosCampos.notas = dc.notas;
        if (typeof dc.fecha_reunion === "string" && dc.fecha_reunion)
          otrosCampos.fecha_reunion = dc.fecha_reunion;
        if (dc.reunion_agendada !== undefined)
          otrosCampos.reunion_agendada = String(dc.reunion_agendada);

        await actualizarLead(convId, {
          nombre: nombreCapturado ?? undefined,
          estado_lead: estadoLead,
          datos_capturados_merge: {
            nombre: nombreCapturado ?? null,
            email: emailFinal ?? null,
            interes: typeof dc.nivel_interes === "string" ? dc.nivel_interes : null,
            miedos: typeof dc.objecion_principal === "string" ? dc.objecion_principal : null,
            ...(Object.keys(otrosCampos).length > 0 ? { otros: otrosCampos } : {}),
          },
        });

        console.log(
          `[vapi-webhook] ✓ Outreach CRM actualizado — conv: ${convId} estado: ${estadoLead} interés: ${String(dc.nivel_interes ?? "?")}`,
        );
      } catch (err) {
        console.error("[vapi-webhook] ✗ Error actualizando lead en CRM:", err);
      }
    }

    if (convId) {
      try {
        const lineas = [`📞 Llamada outreach — ${duracion ? `${duracion}s` : "duración desconocida"}`];
        if (resumen) lineas.push(`Resumen: ${resumen.slice(0, 600)}`);
        if (urlGrabacion) lineas.push(`🎧 Grabación: ${urlGrabacion}`);
        await insertarMensaje(lead.cuenta_id, convId, "sistema", lineas.join("\n"), { tipo: "sistema" });
      } catch (err) {
        console.error("[vapi-webhook] ✗ Error insertando msg sistema:", err);
      }
    }

    console.log(`[vapi-webhook] ✓ Outreach completado — lead: ${lead.nombre}`);
  } else {
    await registrarFalloProspeccion(lead.id, lead.intentos_outreach);
    console.log(
      `[vapi-webhook] ↺ Outreach sin respuesta (${endedReason}) — ` +
      `lead: ${lead.nombre} intento ${lead.intentos_outreach + 1}/3`,
    );
  }

  return NextResponse.json({ ok: true, tipo: "outreach" });
}

// ============================================================
// Handler: llamada desconocida (test desde dashboard Vapi,
// o llamada que no fue pre-registrada en nuestra DB).
// Busca la cuenta por assistantId y guarda lo que pueda.
// ============================================================

async function manejarCallDesconocida(
  message: VapiWebhookMessage,
  callId: string,
): Promise<NextResponse> {
  if (message.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const assistantId = message.call?.assistantId;
  const telefonoCliente = message.call?.customer?.number;

  if (!assistantId || !telefonoCliente) {
    console.warn(`[vapi-webhook] Call desconocida sin assistantId o teléfono — callId: ${callId}`);
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Buscar la cuenta por el assistantId configurado
  const cuenta = await obtenerCuentaPorAssistantId(assistantId);
  if (!cuenta) {
    console.warn(`[vapi-webhook] No se encontró cuenta para assistantId: ${assistantId}`);
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const dc = extraerDatosEstructurados(message);
  const nombreCapturado = dc && typeof dc.nombre_contacto === "string" ? dc.nombre_contacto : null;
  const emailCapturado = dc && typeof dc.email === "string" ? dc.email : null;
  const transcript = message.transcript ?? message.artifact?.transcript ?? null;
  const resumen = message.summary ?? message.analysis?.summary ?? null;
  const duracion = calcularDuracion(message);

  try {
    const conv = await obtenerOCrearConversacion(
      cuenta.id,
      telefonoCliente,
      nombreCapturado ?? message.call?.customer?.name ?? null,
      null,
    );

    if (emailCapturado) {
      await guardarContactosEmail(cuenta.id, conv.id, [emailCapturado]);
    }

    // Insertar mensaje sistema con el resumen de la llamada
    const lineas = [`📞 Llamada${duracion ? ` (${duracion}s)` : ""} — ${message.call?.endedReason ?? "completada"}`];
    if (resumen) lineas.push(`Resumen: ${resumen.slice(0, 600)}`);
    if (message.recordingUrl ?? message.artifact?.recordingUrl) {
      lineas.push(`🎧 Grabación: ${message.recordingUrl ?? message.artifact?.recordingUrl}`);
    }
    if (transcript) lineas.push(`Transcripción disponible`);

    await insertarMensaje(cuenta.id, conv.id, "sistema", lineas.join("\n"), { tipo: "sistema" });

    // Actualizar campos del lead si hay datos estructurados
    if (dc) {
      const estadoLead = nivelInteresAEstadoLead(dc.nivel_interes, dc.reunion_agendada);
      await actualizarLead(conv.id, {
        nombre: nombreCapturado ?? undefined,
        estado_lead: estadoLead,
        datos_capturados_merge: {
          nombre: nombreCapturado ?? null,
          email: emailCapturado ?? null,
          interes: typeof dc.nivel_interes === "string" ? dc.nivel_interes : null,
          miedos: typeof dc.objecion_principal === "string" ? dc.objecion_principal : null,
          ...(typeof dc.proximo_paso === "string" && dc.proximo_paso
            ? { otros: { proximo_paso: dc.proximo_paso, notas: typeof dc.notas === "string" ? dc.notas : "" } }
            : {}),
        },
      });
    }

    // Registrar uso de Vapi
    if (duracion && duracion > 0) {
      registrarUso({
        cuenta_id: cuenta.id,
        proveedor: "vapi",
        segundos: duracion,
        costo_usd: typeof message.call?.cost === "number" ? message.call.cost : 0,
        metadata: { vapi_call_id: callId, tipo: "desconocida" },
      });
    }

    console.log(
      `[vapi-webhook] ✓ Call desconocida guardada — cuenta: ${cuenta.etiqueta} conv: ${conv.id} tel: ${telefonoCliente}`,
    );
    return NextResponse.json({ ok: true, tipo: "call-desconocida" });
  } catch (err) {
    console.error("[vapi-webhook] ✗ Error procesando call desconocida:", err);
    return NextResponse.json({ ok: true });
  }
}

// ============================================================
// Handler principal POST
// ============================================================

export async function POST(req: NextRequest) {
  const headerSecret =
    req.headers.get("x-vapi-secret") ??
    req.headers.get("x-vapi-signature") ??
    null;

  let body: VapiWebhookBody;
  try {
    body = (await req.json()) as VapiWebhookBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const message = body.message;
  if (!message) return NextResponse.json({ error: "Sin message" }, { status: 400 });

  const callId = message.call?.id;
  if (!callId) return NextResponse.json({ ok: true, ignorado: true });

  // ── Ruta 1: llamada de WhatsApp (llamadas_vapi) ───────────
  const llamada = await obtenerLlamadaPorCallId(callId);
  if (llamada) {
    // Validar secret contra el de la cuenta dueña
    const cuentaDueña = await obtenerCuenta(llamada.cuenta_id);
    if (!cuentaDueña?.vapi_webhook_secret) {
      return NextResponse.json(
        { error: "Webhook no autorizado: configurá vapi_webhook_secret" },
        { status: 401 },
      );
    }
    if (!verificarSecretWebhook(headerSecret, cuentaDueña.vapi_webhook_secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tipo = message.type ?? "";

    if (tipo === "end-of-call-report") {
      const transcript = message.transcript ?? message.artifact?.transcript;
      const audio = message.recordingUrl ?? message.artifact?.recordingUrl;
      const resumen = message.summary ?? message.analysis?.summary;
      const duracion = calcularDuracion(message);
      const terminadaEn = message.call?.endedAt ? new Date(message.call.endedAt).toISOString() : null;
      const dc = extraerDatosEstructurados(message);

      await actualizarLlamadaPorCallId(callId, {
        estado: mapearEstado(message.call?.status, message.call?.endedReason),
        transcripcion: transcript ?? undefined,
        audio_url: audio ?? undefined,
        resumen: resumen ?? undefined,
        duracion_seg: duracion ?? undefined,
        costo_usd: typeof message.call?.cost === "number" ? message.call.cost : undefined,
        terminada_en: terminadaEn ?? undefined,
      });

      if (duracion && duracion > 0) {
        registrarUso({
          cuenta_id: llamada.cuenta_id,
          proveedor: "vapi",
          segundos: duracion,
          costo_usd: typeof message.call?.cost === "number" ? message.call.cost : 0,
          metadata: { vapi_call_id: callId, ended_reason: message.call?.endedReason ?? null },
        });
      }

      // Actualizar lead con datos estructurados si los hay
      if (llamada.conversacion_id && dc) {
        try {
          const nombre = typeof dc.nombre_contacto === "string" ? dc.nombre_contacto : undefined;
          const estadoLead = nivelInteresAEstadoLead(dc.nivel_interes, dc.reunion_agendada);
          await actualizarLead(llamada.conversacion_id, {
            nombre,
            estado_lead: estadoLead,
            datos_capturados_merge: {
              nombre: nombre ?? null,
              email: typeof dc.email === "string" ? dc.email : null,
              interes: typeof dc.nivel_interes === "string" ? dc.nivel_interes : null,
              miedos: typeof dc.objecion_principal === "string" ? dc.objecion_principal : null,
              ...(typeof dc.proximo_paso === "string" && dc.proximo_paso
                ? { otros: { proximo_paso: dc.proximo_paso } }
                : {}),
            },
          });
          console.log(`[vapi-webhook] ✓ WhatsApp lead actualizado — conv: ${llamada.conversacion_id} interés: ${String(dc.nivel_interes ?? "?")}`);
        } catch (err) {
          console.error("[vapi-webhook] ✗ Error actualizando lead WhatsApp:", err);
        }
      }

      if (llamada.conversacion_id) {
        try {
          const lineas: string[] = [
            `📞 Llamada ${duracion ? `(${duracion}s)` : ""} — ${message.call?.endedReason ?? "completada"}`,
          ];
          if (resumen) lineas.push(`Resumen: ${resumen.slice(0, 500)}`);
          if (audio) lineas.push(`Grabación: ${audio}`);
          await insertarMensaje(
            llamada.cuenta_id,
            llamada.conversacion_id,
            "sistema",
            lineas.join("\n"),
            { tipo: "sistema" },
          );
        } catch (err) {
          console.error("[vapi-webhook] error insertando msg sistema:", err);
        }
      }

      dispararWebhook(llamada.cuenta_id, "llamada_terminada", {
        llamada_id: llamada.id,
        vapi_call_id: callId,
        conversacion_id: llamada.conversacion_id,
        telefono: llamada.telefono,
        direccion: llamada.direccion,
        estado: mapearEstado(message.call?.status, message.call?.endedReason),
        ended_reason: message.call?.endedReason ?? null,
        duracion_seg: duracion,
        costo_usd: typeof message.call?.cost === "number" ? message.call.cost : null,
        transcripcion: transcript ?? null,
        resumen: resumen ?? null,
        audio_url: audio ?? null,
      });

      return NextResponse.json({ ok: true });
    }

    if (tipo === "status-update") {
      const estadoMapeado = mapearEstado(message.call?.status, message.call?.endedReason);
      const esTerminal = ["completada", "sin_respuesta", "fallida", "finalizada"].includes(estadoMapeado);
      await actualizarLlamadaPorCallId(callId, {
        estado: estadoMapeado,
        ...(esTerminal && !llamada.terminada_en ? { terminada_en: new Date().toISOString() } : {}),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, tipo, ignorado: true });
  }

  // ── Ruta 2: llamada de OUTREACH (prospeccion_llamadas) ────
  const logOutreach = await obtenerRegistroLlamadaPorVapiId(callId);
  if (logOutreach) {
    return manejarWebhookOutreach(message, callId, logOutreach);
  }

  // ── Ruta 3: llamada desconocida (test desde dashboard Vapi,
  //    o cualquier call no registrada). Intentamos salvar los datos. ──
  console.log(`[vapi-webhook] Call no encontrada en DB — intentando resolver por assistantId. callId: ${callId}`);
  return manejarCallDesconocida(message, callId);
}
