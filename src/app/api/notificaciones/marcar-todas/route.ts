import { NextResponse } from "next/server";
import { marcarTodasLeidas } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

/**
 * POST /api/notificaciones/marcar-todas — marca todas las notificaciones
 * del usuario como leídas.
 */
export async function POST() {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  await marcarTodasLeidas(auth.id);
  return NextResponse.json({ ok: true });
}
