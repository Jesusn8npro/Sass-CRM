import { NextResponse, type NextRequest } from "next/server";
import {
  crearCita,
  listarCitasDeCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const citas = await listarCitasDeCuenta(idCuenta);
  return NextResponse.json({ citas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
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

  // Acepta fecha_hora o fecha_iso como ISO string del cliente.
  const fechaRaw =
    typeof payload.fecha_hora === "string"
      ? payload.fecha_hora
      : typeof payload.fecha_iso === "string"
      ? payload.fecha_iso
      : null;
  if (!fechaRaw) {
    return NextResponse.json({ error: "Falta fecha" }, { status: 400 });
  }
  const ms = new Date(fechaRaw).getTime();
  if (!Number.isFinite(ms)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  if (ms < Date.now() - 86400 * 1000) {
    return NextResponse.json(
      { error: "La fecha no puede ser anterior a ayer" },
      { status: 400 },
    );
  }
  const fecha_hora = new Date(ms).toISOString();

  const conversacion_id =
    typeof payload.conversacion_id === "string" && payload.conversacion_id
      ? payload.conversacion_id
      : null;

  const cita = await crearCita(idCuenta, {
    conversacion_id,
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
