import { NextResponse, type NextRequest } from "next/server";
import {
  marcarConversacionComoLeida,
  obtenerConversacionPorId,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

/** POST /api/cuentas/[idCuenta]/conversaciones/[idConversacion]/marcar-leida
 *
 * Marca la conversación como vista por el operador. Resetea el contador
 * de "mensajes nuevos" en la lista de chats. Idempotente. */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idConversacion } = await params;
  if (!idCuenta || !idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  await marcarConversacionComoLeida(idConversacion);
  return NextResponse.json({ ok: true });
}
