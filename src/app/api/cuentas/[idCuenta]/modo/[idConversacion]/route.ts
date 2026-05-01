import { NextResponse, type NextRequest } from "next/server";
import {
  cambiarModo,
  obtenerConversacionPorId,
  type ModoConversacion,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function POST(req: NextRequest, { params }: Contexto) {
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

  let payload: { modo?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const modo = payload.modo;
  if (modo !== "IA" && modo !== "HUMANO") {
    return NextResponse.json(
      { error: "Modo inválido. Usa 'IA' o 'HUMANO'." },
      { status: 400 },
    );
  }

  cambiarModo(convId, modo as ModoConversacion);
  return NextResponse.json({ ok: true, modo });
}
