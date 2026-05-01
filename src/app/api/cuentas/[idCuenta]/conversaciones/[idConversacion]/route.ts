import { NextResponse, type NextRequest } from "next/server";
import {
  borrarConversacion,
  obtenerConversacionPorId,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const cuentaId = Number(idCuenta);
  const convId = Number(idConversacion);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(convId) ||
    convId <= 0
  ) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const conv = obtenerConversacionPorId(convId);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  if (conv.cuenta_id !== cuentaId) {
    return NextResponse.json(
      { error: "La conversación no pertenece a esta cuenta" },
      { status: 403 },
    );
  }
  borrarConversacion(convId);
  return NextResponse.json({ ok: true });
}
