import { NextResponse, type NextRequest } from "next/server";
import {
  crearCita,
  listarCitasDeCuenta,
  obtenerCuenta,
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
  const citas = listarCitasDeCuenta(id);
  return NextResponse.json({ citas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: {
    conversacion_id?: unknown;
    cliente_nombre?: unknown;
    cliente_telefono?: unknown;
    fecha_iso?: unknown;
    fecha_hora?: unknown;
    duracion_min?: unknown;
    tipo?: unknown;
    notas?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cliente_nombre =
    typeof payload.cliente_nombre === "string"
      ? payload.cliente_nombre.trim()
      : "";
  if (!cliente_nombre) {
    return NextResponse.json(
      { error: "cliente_nombre es obligatorio" },
      { status: 400 },
    );
  }

  let fecha_hora: number;
  if (typeof payload.fecha_hora === "number") {
    fecha_hora = Math.floor(payload.fecha_hora);
  } else if (typeof payload.fecha_iso === "string") {
    const ms = new Date(payload.fecha_iso).getTime();
    if (!Number.isFinite(ms)) {
      return NextResponse.json(
        { error: "fecha_iso inválida" },
        { status: 400 },
      );
    }
    fecha_hora = Math.floor(ms / 1000);
  } else {
    return NextResponse.json({ error: "Falta fecha" }, { status: 400 });
  }

  const ahora = Math.floor(Date.now() / 1000);
  if (fecha_hora < ahora - 86400) {
    return NextResponse.json(
      { error: "La fecha no puede ser anterior a ayer" },
      { status: 400 },
    );
  }

  const cita = crearCita(id, {
    conversacion_id:
      typeof payload.conversacion_id === "number"
        ? payload.conversacion_id
        : null,
    cliente_nombre,
    cliente_telefono:
      typeof payload.cliente_telefono === "string" &&
      payload.cliente_telefono.trim()
        ? payload.cliente_telefono.replace(/[^\d]/g, "")
        : null,
    fecha_hora,
    duracion_min:
      typeof payload.duracion_min === "number" && payload.duracion_min > 0
        ? Math.min(480, Math.floor(payload.duracion_min))
        : 30,
    tipo:
      typeof payload.tipo === "string" && payload.tipo.trim()
        ? payload.tipo.trim()
        : null,
    notas:
      typeof payload.notas === "string" && payload.notas.trim()
        ? payload.notas.trim()
        : null,
  });
  return NextResponse.json({ cita }, { status: 201 });
}
