import { NextResponse } from "next/server";
import {
  contarNoLeidasDeUsuario,
  listarNotificacionesDeUsuario,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

/**
 * GET /api/notificaciones — lista las últimas 50 notificaciones del
 * usuario logueado + count de no leídas.
 */
export async function GET() {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const [notificaciones, no_leidas] = await Promise.all([
    listarNotificacionesDeUsuario(auth.id, 50),
    contarNoLeidasDeUsuario(auth.id),
  ]);
  return NextResponse.json({ notificaciones, no_leidas });
}
