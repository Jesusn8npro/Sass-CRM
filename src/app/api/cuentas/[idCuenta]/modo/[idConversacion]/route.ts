import { NextResponse, type NextRequest } from "next/server";
import {
  cambiarModo,
  obtenerConversacionPorId,
  type ModoConversacion,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function POST(req: NextRequest, { params }: Contexto) {
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

  const payload = await parsearJSON<{ modo?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  const modo = payload.modo;
  if (modo !== "IA" && modo !== "HUMANO") {
    return NextResponse.json(
      { error: "Modo inválido. Usa 'IA' o 'HUMANO'." },
      { status: 400 },
    );
  }

  await cambiarModo(idConversacion, modo as ModoConversacion);
  return NextResponse.json({ ok: true, modo });
}
