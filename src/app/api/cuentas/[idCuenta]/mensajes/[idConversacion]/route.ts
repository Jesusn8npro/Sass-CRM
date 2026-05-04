import { NextResponse, type NextRequest } from "next/server";
import {
  encolarBandejaSalida,
  insertarMensaje,
  obtenerConversacionPorId,
  obtenerMensajes,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
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

  const mensajes = await obtenerMensajes(idConversacion, 200);
  return NextResponse.json({ conversacion: conv, mensajes });
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

  const payload = await parsearJSON<{ contenido?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  const contenido =
    typeof payload.contenido === "string" ? payload.contenido.trim() : "";
  if (!contenido) {
    return NextResponse.json(
      { error: "El contenido no puede estar vacío" },
      { status: 400 },
    );
  }

  await insertarMensaje(idCuenta, idConversacion, "humano", contenido);
  await encolarBandejaSalida(idCuenta, idConversacion, conv.telefono, contenido);
  return NextResponse.json({ ok: true });
}
