import { NextResponse, type NextRequest } from "next/server";
import {
  encolarBandejaSalida,
  insertarMensaje,
  listarConversaciones,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const conversaciones = await listarConversaciones(idCuenta);
  return NextResponse.json({ conversaciones });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;
  if (cuenta.estado !== "conectado") {
    return NextResponse.json(
      { error: "La cuenta no está conectada" },
      { status: 409 },
    );
  }

  const payload = await parsearJSON<{ telefono?: unknown; mensaje?: unknown; nombre?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

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

  const conv = await obtenerOCrearConversacion(idCuenta, telefono, nombre);
  await insertarMensaje(idCuenta, conv.id, "humano", mensaje);
  await encolarBandejaSalida(idCuenta, conv.id, telefono, mensaje);

  return NextResponse.json({ conversacion: conv }, { status: 201 });
}
