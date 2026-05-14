import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  actualizarEmailProspeccionPorResendId,
  type RegistroEmailProspeccion,
} from "@/lib/db/outreachLogs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/resend/webhook
 *
 * Recibe eventos de entrega de Resend después de enviar emails de outreach.
 * Eventos manejados:
 *  - email.delivered  → estado: entregado
 *  - email.bounced    → estado: rebotado
 *  - email.complained → estado: spam
 *
 * Verificación: HMAC SHA-256 contra RESEND_WEBHOOK_SECRET.
 * Configurar en Resend Dashboard → Webhooks → Signing Secret.
 */

// ── Verificación de firma ────────────────────────────────────────────────

function verificarFirmaResend(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Resend usa svix: el mensaje firmado es "{svix-id}.{svix-timestamp}.{body}"
  const mensaje = `${svixId}.${svixTimestamp}.${rawBody}`;

  // El secret de svix viene como "whsec_<base64>" — decodificamos la parte base64
  const secretBase64 = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretBase64, "base64");
  } catch {
    return false;
  }

  const hmac = createHmac("sha256", secretBytes);
  hmac.update(mensaje);
  const firmaCalculada = `v1,${hmac.digest("base64")}`;

  // svix-signature puede tener múltiples firmas separadas por espacio
  const firmas = svixSignature.split(" ");
  for (const firma of firmas) {
    try {
      if (
        timingSafeEqual(
          Buffer.from(firmaCalculada),
          Buffer.from(firma.trim()),
        )
      ) {
        return true;
      }
    } catch {
      // Buffers de distinto largo — no coinciden
    }
  }
  return false;
}

// ── Tipos del payload Resend ─────────────────────────────────────────────

interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    // bounced / complained events incluyen razón
    reason?: string;
  };
}

// ── Mapa de eventos → estado en outreach_email_logs ─────────────────────

const MAPA_ESTADO: Record<string, RegistroEmailProspeccion["estado_envio"]> = {
  "email.delivered": "entregado",
  "email.bounced": "rebotado",
  "email.complained": "spam",
};

// ── Handler principal ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (
      !verificarFirmaResend(rawBody, svixId, svixTimestamp, svixSignature, secret)
    ) {
      console.warn("[resend-webhook] firma inválida — rechazado");
      return NextResponse.json({ error: "firma_invalida" }, { status: 401 });
    }
  } else {
    // Sin secret configurado: solo logueamos advertencia pero seguimos.
    // Configurar RESEND_WEBHOOK_SECRET en producción para mayor seguridad.
    console.warn(
      "[resend-webhook] ⚠ RESEND_WEBHOOK_SECRET no configurado — aceptando sin verificar firma",
    );
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = payload.type ?? "";
  const emailId = payload.data?.email_id;

  if (!emailId) {
    return NextResponse.json({ ok: true, ignorado: true });
  }

  const nuevoEstado = MAPA_ESTADO[tipo];
  if (!nuevoEstado) {
    // Evento que no manejamos (email.sent, email.opened, etc.) — ignorar
    return NextResponse.json({ ok: true, ignorado: true, tipo });
  }

  try {
    await actualizarEmailProspeccionPorResendId(emailId, nuevoEstado);

    console.log(
      `[resend-webhook] ✓ Email ${emailId} → ${nuevoEstado} (evento: ${tipo})`,
    );

    return NextResponse.json({ ok: true, tipo, estado: nuevoEstado });
  } catch (err) {
    console.error("[resend-webhook] error actualizando email log:", err);
    return NextResponse.json(
      { error: "error_interno" },
      { status: 500 },
    );
  }
}
