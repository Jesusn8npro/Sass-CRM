import { NextResponse, type NextRequest } from "next/server";
import {
  cambiarModo,
  obtenerConversacionPorId,
  obtenerCuenta,
  type ModoConversacion,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function POST(req: NextRequest, { params }: Contexto) {
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

  await cambiarModo(idConversacion, modo as ModoConversacion);
  return NextResponse.json({ ok: true, modo });
}
