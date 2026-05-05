import { NextResponse } from "next/server";
import { requerirSesion } from "@/lib/auth/sesion";
import { enviarBienvenida } from "@/lib/emails/disparadores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/post-signup
 *
 * Hook que el cliente llama después de crear cuenta o confirmar email.
 * Dispara el email de bienvenida (fire-and-forget) e informa al cliente
 * que el flujo de signup terminó. Idempotente: la propia idempotencyKey
 * de Resend evita reenvíos al mismo usuario.
 *
 * El endpoint requiere sesión activa — solo el dueño de la cuenta puede
 * disparar su propio email.
 */
export async function POST() {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  // Disparo no bloqueante: si Resend está caído, igual respondemos OK.
  void enviarBienvenida(auth.id);

  return NextResponse.json({ ok: true });
}
