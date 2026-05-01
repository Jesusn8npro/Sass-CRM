import { NextResponse, type NextRequest } from "next/server";
import {
  encolarBandejaSalida,
  insertarMensaje,
  obtenerConversacionPorId,
  obtenerMensajes,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

function validarIds(idCuenta: string, idConv: string) {
  const cuentaId = Number(idCuenta);
  const convId = Number(idConv);
  if (
    !Number.isFinite(cuentaId) ||
    cuentaId <= 0 ||
    !Number.isFinite(convId) ||
    convId <= 0
  ) {
    return null;
  }
  return { cuentaId, convId };
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validarIds(idCuenta, idConversacion);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const conv = obtenerConversacionPorId(ids.convId);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  if (conv.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "La conversación no pertenece a esta cuenta" },
      { status: 403 },
    );
  }

  const mensajes = obtenerMensajes(ids.convId, 200);
  return NextResponse.json({ conversacion: conv, mensajes });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const ids = validarIds(idCuenta, idConversacion);
  if (!ids) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const conv = obtenerConversacionPorId(ids.convId);
  if (!conv) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }
  if (conv.cuenta_id !== ids.cuentaId) {
    return NextResponse.json(
      { error: "La conversación no pertenece a esta cuenta" },
      { status: 403 },
    );
  }

  let payload: { contenido?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const contenido =
    typeof payload.contenido === "string" ? payload.contenido.trim() : "";
  if (!contenido) {
    return NextResponse.json(
      { error: "El contenido no puede estar vacío" },
      { status: 400 },
    );
  }

  insertarMensaje(ids.cuentaId, ids.convId, "humano", contenido);
  encolarBandejaSalida(ids.cuentaId, ids.convId, conv.telefono, contenido);
  return NextResponse.json({ ok: true });
}
