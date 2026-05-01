import { NextResponse, type NextRequest } from "next/server";
import {
  encolarBandejaSalida,
  insertarMensaje,
  listarConversaciones,
  obtenerCuenta,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conversaciones = listarConversaciones(id);
  return NextResponse.json({ conversaciones });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (cuenta.estado !== "conectado") {
    return NextResponse.json(
      { error: "La cuenta no está conectada" },
      { status: 409 },
    );
  }

  let payload: { telefono?: unknown; mensaje?: unknown; nombre?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const telefonoRaw =
    typeof payload.telefono === "string" ? payload.telefono : "";
  const telefono = telefonoRaw.replace(/[^\d]/g, "");
  if (telefono.length < 8 || telefono.length > 15) {
    return NextResponse.json(
      { error: "Número inválido. Incluí código de país (ej: 5491123456789)." },
      { status: 400 },
    );
  }

  const mensaje =
    typeof payload.mensaje === "string" ? payload.mensaje.trim() : "";
  if (!mensaje) {
    return NextResponse.json(
      { error: "El mensaje no puede estar vacío" },
      { status: 400 },
    );
  }

  const nombre =
    typeof payload.nombre === "string" && payload.nombre.trim()
      ? payload.nombre.trim()
      : null;

  const conv = obtenerOCrearConversacion(id, telefono, nombre);
  insertarMensaje(id, conv.id, "humano", mensaje);
  encolarBandejaSalida(id, conv.id, telefono, mensaje);

  return NextResponse.json({ conversacion: conv }, { status: 201 });
}
