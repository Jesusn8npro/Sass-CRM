import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarLead,
  actualizarLlamadaPorCallId,
  guardarContactosEmail,
  guardarContactosTelefono,
  insertarMensaje,
  marcarLeadImportado,
  obtenerCuenta,
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
// Manejo de llamadas de OUTREACH (no WhatsApp)
// ============================================================

import type { RegistroLlamadaProspeccion } from "@/lib/db/outreachLogs";

/** Resultados de Vapi que consideramos "completado" (el prospect atendió). */
const RESULTADOS_COMPLETADO = new Set([
  "customer-ended-call",
  "assistant-ended-call",
  "pipeline-error-openai-voice-failed",
  "silence-timed-out",
]);

/** Mapea el nivel_interes capturado por Vapi al estado_lead del CRM. */
function nivelInteresAEstadoLead(
  nivel: unknown,
  reunionAgendada: unknown,
): EstadoLead {
  if (reunionAgendada === true) return "negociacion";
  if (nivel === "alto") return "interesado";
  if (nivel === "medio" || nivel === "bajo") return "contactado";
  if (nivel === "sin_interes") return "perdido";
  return "contactado";
}

async function manejarWebhookOutreach(
  message: VapiWebhookMessage,
  callId: string,
  logOutreach: RegistroLlamadaProspeccion,
  _headerSecret: string | null,
): Promise<NextResponse> {
  const tipo = message.type ?? "";

  if (tipo === "end-of-call-report") {
    const transcript = message.transcript ?? message.artifact?.transcript ?? null;
    const urlGrabacion = message.recordingUrl ?? message.artifact?.recordingUrl ?? null;
    const resumen = message.summary ?? message.analysis?.summary ?? null;
    const endedReason = message.call?.endedReason ?? "";
    const datosCapturados = message.analysis?.structuredData ?? null;

    const inicio = message.call?.startedAt ? new Date(message.call.startedAt).getTime() : null;
    const fin = message.call?.endedAt ? new Date(message.call.endedAt).getTime() : null;
    const duracion = inicio && fin ? Math.max(0, Math.floor((fin - inicio) / 1000)) : null;

    // 1. Actualizar log de la llamada outreach
    await actualizarRegistroLlamadaPorVapiId(callId, {
      resultado: endedReason || "completada",
      transcripcion: transcript,
      url_grabacion: urlGrabacion,
      duracion_segundos: duracion,
      costo_usd: typeof message.call?.cost === "number" ? message.call.cost : null,
      resumen,
      datos_capturados: datosCapturados,
    });

    // 2. Decidir estado final del lead
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

      // Resolver datos capturados por Vapi
      const nombreCapturado = dc && typeof dc.nombre_contacto === "string" ? dc.nombre_contacto : null;
      const emailCapturado = dc && typeof dc.email === "string" ? dc.email : null;
      const emailFinal = emailCapturado ?? lead.email ?? null;
      const nombreFinal = nombreCapturado ?? lead.nombre;

      // Sincronizar nombre/email de vuelta al lead (fire-and-forget)
      if (dc) {
        void sincronizarDatosCapturadosAlLead(lead.id, {
          email: emailFinal,
          nombre_contacto: nombreCapturado,
        });
      }

      // Obtener o crear conversación en el CRM
      // (normalmente ya existe porque disparadorVapi la pre-creó al iniciar la llamada)
      let convId = lead.conversacion_id ?? null;
      try {
        const telefono =
          lead.telefono ||
          (emailFinal
            ? `mail_${emailFinal.split("@")[0]}_${lead.id.slice(0, 6)}`
            : `lead_${lead.id.slice(0, 8)}`);

        const conv = await obtenerOCrearConversacion(
          lead.cuenta_id,
          telefono,
          nombreFinal,
          null,
        );
        convId = conv.id;

        // Guardar contactos vinculados si no estaban
        if (emailFinal) {
          await guardarContactosEmail(lead.cuenta_id, conv.id, [emailFinal]);
        }
        if (lead.telefono) {
          await guardarContactosTelefono(lead.cuenta_id, conv.id, [lead.telefono], telefono);
        }

        // Marcar como importado si todavía no
        if (!lead.importado || !lead.conversacion_id) {
          await marcarLeadImportado(lead.id, conv.id);
        }
      } catch (err) {
        console.error("[vapi-webhook] ✗ Error resolviendo conversación CRM:", err);
      }

      // Poblar campos del lead en el CRM con los datos extraídos por Vapi
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
            `[vapi-webhook] ✓ CRM actualizado — conv: ${convId} ` +
            `estado: ${estadoLead} interés: ${String(dc.nivel_interes ?? "?")}`,
          );
        } catch (err) {
          console.error("[vapi-webhook] ✗ Error actualizando lead en CRM:", err);
        }
      }

      // Insertar mensaje sistema con resumen y grabación
      if (convId) {
        try {
          const lineasMsg: string[] = [
            `📞 Llamada de prospección — ${duracion ? `${duracion}s` : "duración desconocida"}`,
          ];
          if (resumen) lineasMsg.push(`Resumen: ${resumen.slice(0, 600)}`);
          if (urlGrabacion) lineasMsg.push(`🎧 Grabación: ${urlGrabacion}`);
          await insertarMensaje(lead.cuenta_id, convId, "sistema", lineasMsg.join("\n"), { tipo: "sistema" });
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

  // status-update: solo logueamos, no cambiamos estado todavía
  if (tipo === "status-update") {
    return NextResponse.json({ ok: true, tipo: "outreach-status" });
  }

  return NextResponse.json({ ok: true, ignorado: true });
}

/**
 * Webhook que recibe Vapi cada vez que pasa algo en una llamada.
 * Tipos de eventos relevantes:
 *  - status-update: cambio de estado (queued / ringing / in-progress / ended)
 *  - end-of-call-report: TODO el detalle final (transcript, summary, recording, costo)
 *  - speech-update / transcript: tiempo real (no lo persistimos para no spamear DB)
 *
 * Verificación: si el assistant tiene serverUrlSecret seteado, Vapi
 * manda el header `x-vapi-secret` con ese valor. Lo cruzamos contra
 * el guardado en cuentas.vapi_webhook_secret para validar.
 *
 * Para correlacionar, leemos message.call.id (= vapi_call_id en nuestra DB).
 */

interface VapiWebhookCall {
  id?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  customer?: { number?: string };
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
  };
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
  };
}

interface VapiWebhookBody {
  message?: VapiWebhookMessage;
}

function mapearEstado(
  estadoVapi: string | undefined,
  endedReason: string | undefined,
): EstadoLlamada {
  if (estadoVapi === "queued" || estadoVapi === "ringing") return "sonando";
  if (estadoVapi === "in-progress" || estadoVapi === "forwarding")
    return "en_curso";
  if (estadoVapi === "ended") {
    if (
      endedReason === "customer-did-not-answer" ||
      endedReason === "voicemail" ||
      endedReason === "no-answer"
    ) {
      return "sin_respuesta";
    }
    if (endedReason && endedReason.includes("error")) return "fallida";
    return "completada";
  }
  return "iniciando";
}

export async function POST(req: NextRequest) {
  // Verificación de secret. Probamos primero header oficial; si Vapi
  // está usando otro nombre, también probamos x-vapi-signature.
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
  if (!message) {
    return NextResponse.json({ error: "Sin message" }, { status: 400 });
  }
  const callId = message.call?.id;
  if (!callId) {
    // Eventos sin call.id (ej: function-call sin contexto) los ignoramos.
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Buscamos la llamada en DB — primero en llamadas_vapi (WhatsApp),
  // luego en outreach_call_logs (cold outreach)
  const llamada = await obtenerLlamadaPorCallId(callId);

  // ── Llamada de OUTREACH (no es de WhatsApp) ───────────────────────────
  if (!llamada) {
    const logOutreach = await obtenerRegistroLlamadaPorVapiId(callId);
    if (logOutreach) {
      return manejarWebhookOutreach(message, callId, logOutreach, headerSecret);
    }
    console.warn(
      `[vapi-webhook] call_id ${callId} no existe en DB — ignorado`,
    );
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Validar secret contra el de la cuenta dueña. Sin secret configurado
  // rechazamos — el webhook es público y no podemos confiar en payloads
  // sin firmar (riesgo de inyección de transcripciones / costos falsos).
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

  // Manejo del evento principal: end-of-call-report
  if (tipo === "end-of-call-report") {
    const transcript = message.transcript ?? message.artifact?.transcript;
    const audio = message.recordingUrl ?? message.artifact?.recordingUrl;
    const resumen = message.summary ?? message.analysis?.summary;
    const inicio = message.call?.startedAt
      ? new Date(message.call.startedAt).getTime()
      : null;
    const fin = message.call?.endedAt
      ? new Date(message.call.endedAt).getTime()
      : null;
    const duracion =
      inicio && fin ? Math.max(0, Math.floor((fin - inicio) / 1000)) : null;
    const terminadaEn = fin ? new Date(fin).toISOString() : null;
    await actualizarLlamadaPorCallId(callId, {
      estado: mapearEstado(message.call?.status, message.call?.endedReason),
      transcripcion: transcript ?? undefined,
      audio_url: audio ?? undefined,
      resumen: resumen ?? undefined,
      duracion_seg: duracion ?? undefined,
      costo_usd:
        typeof message.call?.cost === "number" ? message.call.cost : undefined,
      terminada_en: terminadaEn ?? undefined,
    });

    // Registrar uso para facturación. Vapi reporta el costo real en
    // `message.call.cost` (USD); la duración la usamos como métrica.
    if (duracion && duracion > 0) {
      registrarUso({
        cuenta_id: llamada.cuenta_id,
        proveedor: "vapi",
        segundos: duracion,
        costo_usd:
          typeof message.call?.cost === "number" ? message.call.cost : 0,
        metadata: {
          vapi_call_id: callId,
          ended_reason: message.call?.endedReason ?? null,
        },
      });
    }

    // Insertamos un mensaje en la conversación con resumen de la llamada
    if (llamada.conversacion_id) {
      const lineas: string[] = [];
      lineas.push(
        `📞 Llamada ${duracion ? `(${duracion}s)` : ""} — ${
          message.call?.endedReason ?? "completada"
        }`,
      );
      if (resumen) lineas.push(`Resumen: ${resumen.slice(0, 500)}`);
      if (audio) lineas.push(`Grabación: ${audio}`);
      try {
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
    // Webhook saliente al usuario (n8n / Make / etc) — fire-and-forget
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

  // Manejo de status-update (cambios de estado durante la llamada)
  if (tipo === "status-update") {
    const estadoMapeado = mapearEstado(message.call?.status, message.call?.endedReason);
    const esTerminal = ["completada", "sin_respuesta", "fallida", "finalizada"].includes(estadoMapeado);
    await actualizarLlamadaPorCallId(callId, {
      estado: estadoMapeado,
      ...(esTerminal && !llamada.terminada_en ? { terminada_en: new Date().toISOString() } : {}),
    });
    return NextResponse.json({ ok: true });
  }

  // Otros eventos (transcript en vivo, function-call, etc) los ignoramos
  // por ahora para no crecer la DB sin necesidad.
  return NextResponse.json({ ok: true, tipo, ignorado: true });
}
