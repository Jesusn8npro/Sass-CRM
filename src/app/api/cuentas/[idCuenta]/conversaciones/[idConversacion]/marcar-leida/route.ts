import { NextResponse, type NextRequest } from "next/server";
import {
  marcarConversacionComoLeida,
  obtenerConversacionPorId,
} from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

/** POST /api/cuentas/[idCuenta]/conversaciones/[idConversacion]/marcar-leida
 *
 * Marca la conversación como vista por el operador. Resetea el contador
 * de "mensajes nuevos" en la lista de chats. Idempotente. */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (!idConversacion) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
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
