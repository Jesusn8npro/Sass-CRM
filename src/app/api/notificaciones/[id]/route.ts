import { NextResponse, type NextRequest } from "next/server";
import { marcarNotificacionLeida } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notificaciones/[id] — marca una notificación como leída.
 * (RLS chequea ownership a nivel DB.)
 */
export async function PATCH(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await marcarNotificacionLeida(id);
  return NextResponse.json({ ok: true });
}
