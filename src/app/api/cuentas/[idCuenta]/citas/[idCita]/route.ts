import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCita,
  borrarCita,
  obtenerCita,
  obtenerCuenta,
  type EstadoCita,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idCita: string }>;
}

const ESTADOS_VALIDOS: EstadoCita[] = [
  "agendada",
  "confirmada",
  "realizada",
  "cancelada",
  "no_asistio",
];

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idCita } = await params;
  if (!idCuenta || !idCita) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const cita = await obtenerCita(idCita);
  if (!cita || cita.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cambios: Parameters<typeof actualizarCita>[1] = {};
  if (
    typeof payload.cliente_nombre === "string" &&
    payload.cliente_nombre.trim()
  ) {
    cambios.cliente_nombre = payload.cliente_nombre.trim();
  }
  if (typeof payload.cliente_telefono === "string") {
    cambios.cliente_telefono =
      payload.cliente_telefono.replace(/[^\d]/g, "") || null;
  }
  // fecha_iso o fecha_hora como ISO string del cliente — se pasa directo.
  const fechaRaw =
    typeof payload.fecha_iso === "string"
      ? payload.fecha_iso
      : typeof payload.fecha_hora === "string"
      ? payload.fecha_hora
      : null;
  if (fechaRaw) {
    const ms = new Date(fechaRaw).getTime();
    if (Number.isFinite(ms)) cambios.fecha_hora = new Date(ms).toISOString();
  }
  if (
    typeof payload.duracion_min === "number" &&
    Number.isFinite(payload.duracion_min) &&
    payload.duracion_min > 0
  ) {
    cambios.duracion_min = Math.min(480, Math.floor(payload.duracion_min));
  }
  if (typeof payload.tipo === "string") {
    cambios.tipo = payload.tipo.trim() || null;
  }
  if (
    typeof payload.estado === "string" &&
    ESTADOS_VALIDOS.includes(payload.estado as EstadoCita)
  ) {
    cambios.estado = payload.estado as EstadoCita;
  }
  if (typeof payload.notas === "string") {
    cambios.notas = payload.notas.trim() || null;
  }
  if (typeof payload.recordatorio_enviado === "boolean") {
    cambios.recordatorio_enviado = payload.recordatorio_enviado;
  }

  const actualizada = await actualizarCita(idCita, cambios);
  return NextResponse.json({ cita: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idCita } = await params;
  if (!idCuenta || !idCita) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const cita = await obtenerCita(idCita);
  if (!cita || cita.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }
  await borrarCita(idCita);
  return NextResponse.json({ ok: true });
}
