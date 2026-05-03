import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarLlamadaPorCallId,
  insertarMensaje,
  obtenerCuenta,
  obtenerLlamadaPorCallId,
  type EstadoLlamada,
} from "@/lib/baseDatos";
import { verificarSecretWebhook } from "@/lib/vapi";
import { dispararWebhook } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

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

  // Buscamos la llamada en DB
  const llamada = await obtenerLlamadaPorCallId(callId);
  if (!llamada) {
    // Llamada que no iniciamos nosotros (ej: inbound directa) — la
    // guardamos como "huérfana" sería complejo, mejor reportamos.
    console.warn(
      `[vapi-webhook] call_id ${callId} no existe en DB, evento ignorado`,
    );
    return NextResponse.json({ ok: true, ignorado: true });
  }

  // Validar secret contra el de la cuenta dueña
  const cuentaDueña = await obtenerCuenta(llamada.cuenta_id);
  if (cuentaDueña?.vapi_webhook_secret) {
    const ok = verificarSecretWebhook(
      headerSecret,
      cuentaDueña.vapi_webhook_secret,
    );
    if (!ok) {
      console.warn(
        `[vapi-webhook] secret inválido para call ${callId} (cuenta ${llamada.cuenta_id})`,
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    await actualizarLlamadaPorCallId(callId, {
      estado: mapearEstado(message.call?.status, message.call?.endedReason),
    });
    return NextResponse.json({ ok: true });
  }

  // Otros eventos (transcript en vivo, function-call, etc) los ignoramos
  // por ahora para no crecer la DB sin necesidad.
  return NextResponse.json({ ok: true, tipo, ignorado: true });
}
