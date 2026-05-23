import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { obtenerUsuarioApp } from "@/lib/db/usuarios";
import { enviarEmail, urlApp } from "@/lib/emails/cliente";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/test-email
 *
 * Manda un email de prueba al usuario logueado para confirmar que la
 * integración Resend está funcionando. Devuelve el resultado del envío
 * para que el frontend muestre OK / motivo concreto.
 *
 * No respeta `notificaciones_email_activas` — es un test bajo pedido
 * explícito del usuario, no una notificación automática.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth, cuenta } = acceso;

  // Rate limit modesto para evitar abuso/spam de Resend desde la UI.
  const limite = verificarRateLimit(`${auth.id}:test-email`, 5, 60);
  if (limite) return limite;

  const usuario = await obtenerUsuarioApp(auth.id);
  if (!usuario?.email) {
    return NextResponse.json(
      { ok: false, motivo: "sin_email_usuario" },
      { status: 400 },
    );
  }

  const subject = `INYECTAIA · Prueba de email (${cuenta.etiqueta})`;
  const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; color: #18181b;">
  <div style="background: linear-gradient(135deg, #10b981, #14b8a6); padding: 24px; border-radius: 16px; color: white; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Email de prueba ✉️</h1>
  </div>
  <p style="font-size: 15px; line-height: 1.6;">Hola ${escaparHtml(usuario.nombre || "")},</p>
  <p style="font-size: 15px; line-height: 1.6;">
    Si estás leyendo esto, tu integración con <strong>Resend</strong> está funcionando.
    Vas a recibir bienvenidas, reportes semanales, alertas de WhatsApp caído y
    notificaciones de pago en este buzón.
  </p>
  <p style="font-size: 15px; line-height: 1.6;">
    Cuenta: <strong>${escaparHtml(cuenta.etiqueta)}</strong>
  </p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="${urlApp()}/app/cuentas/${cuenta.id}" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; display: inline-block;">
      Abrir panel →
    </a>
  </div>
</body></html>
  `.trim();

  const r = await enviarEmail({
    to: usuario.email,
    subject,
    html,
    idempotencyKey: `test_email:${cuenta.id}:${Date.now()}`,
  });

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, motivo: r.motivo, detalle: r.detalle },
      { status: r.motivo === "sin_api_key" ? 503 : 500 },
    );
  }

  return NextResponse.json({ ok: true, id: r.id, to: usuario.email });
}

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
