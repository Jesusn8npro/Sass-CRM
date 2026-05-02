/**
 * Capa central de notificaciones del sistema.
 *
 * Crea la notificación in-app (badge en sidebar + página /notificaciones)
 * y opcionalmente manda email vía Resend si `RESEND_API_KEY` está set.
 *
 * Hay rate-limit por tipo+cuenta+15min para no spamear si una cuenta
 * se desconecta-reconecta-desconecta varias veces seguidas.
 */

import {
  crearNotificacion,
  existeNotificacionReciente,
  marcarEmailEnviado,
  obtenerCuenta,
  obtenerUsuarioApp,
  type TipoNotificacion,
} from "./baseDatos";

const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim() || null;
const RESEND_FROM = process.env.RESEND_FROM?.trim() || "Sass-CRM <noreply@sass-crm.dev>";

/**
 * Notifica al dueño de una cuenta sobre un evento. Idempotente:
 * si ya hay notificación reciente del mismo tipo para esta cuenta,
 * no crea otra.
 */
export async function notificarCuenta(opciones: {
  cuentaId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  metadata?: Record<string, unknown>;
  /** Saltea el rate-limit. Default false. */
  forzar?: boolean;
}): Promise<void> {
  const cuenta = await obtenerCuenta(opciones.cuentaId);
  if (!cuenta) return;
  const usuarioId = cuenta.usuario_id;
  if (!usuarioId) return;

  if (
    !opciones.forzar &&
    (await existeNotificacionReciente(
      usuarioId,
      opciones.cuentaId,
      opciones.tipo,
    ))
  ) {
    return; // ya hay una reciente, skip
  }

  const notif = await crearNotificacion({
    usuario_id: usuarioId,
    cuenta_id: opciones.cuentaId,
    tipo: opciones.tipo,
    titulo: opciones.titulo,
    mensaje: opciones.mensaje,
    metadata: opciones.metadata ?? null,
  });

  // Email opcional (Resend) — fire-and-forget
  if (RESEND_API_KEY) {
    void mandarEmail(notif.id, usuarioId, opciones).catch((err) => {
      console.error("[notif] error mandando email:", err);
    });
  }
}

async function mandarEmail(
  notifId: string,
  usuarioId: string,
  opciones: {
    cuentaId: string;
    tipo: TipoNotificacion;
    titulo: string;
    mensaje: string;
  },
): Promise<void> {
  if (!RESEND_API_KEY) return;
  const usuario = await obtenerUsuarioApp(usuarioId);
  if (!usuario?.email) return;

  const baseUrl = process.env.VAPI_PUBLIC_URL?.trim() || "http://localhost:3000";
  const linkPanel = `${baseUrl.replace(/\/$/, "")}/app/cuentas/${opciones.cuentaId}`;

  const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; color: #18181b;">
  <div style="background: linear-gradient(135deg, #10b981, #14b8a6); padding: 24px; border-radius: 16px; color: white; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${escaparHtml(opciones.titulo)}</h1>
  </div>
  <p style="font-size: 15px; line-height: 1.6;">Hola ${escaparHtml(usuario.nombre || "")},</p>
  <p style="font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${escaparHtml(opciones.mensaje)}</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="${linkPanel}" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; display: inline-block;">
      Abrir panel →
    </a>
  </div>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
  <p style="font-size: 12px; color: #71717a;">
    Recibís este email porque sos dueño de una cuenta en Sass-CRM.
    Para dejar de recibir notificaciones, andá a tu panel → Mi Cuenta.
  </p>
</body></html>
  `.trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: usuario.email,
        subject: opciones.titulo,
        html,
      }),
    });
    if (res.ok) {
      await marcarEmailEnviado(notifId);
    } else {
      const detalle = await res.text().catch(() => "");
      console.warn(
        `[notif] Resend ${res.status}: ${detalle.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.error("[notif] fetch Resend falló:", err);
  }
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Helpers shorthand para los eventos comunes
export async function notificarCuentaDesconectada(
  cuentaId: string,
  etiquetaCuenta: string,
  motivo: string,
): Promise<void> {
  await notificarCuenta({
    cuentaId,
    tipo: "cuenta_desconectada",
    titulo: `WhatsApp desconectado: ${etiquetaCuenta}`,
    mensaje:
      `Tu cuenta "${etiquetaCuenta}" se desconectó de WhatsApp.\n\n` +
      `Motivo: ${motivo}\n\n` +
      `Para volver a conectarla entrá al panel y escaneá el QR. ` +
      `Mientras esté desconectada, el bot no responde mensajes ni puede ` +
      `hacer llamadas con esta cuenta.`,
    metadata: { motivo },
  });
}
