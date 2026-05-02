import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCita,
  borrarCita,
  obtenerCita,
  type EstadoCita,
} from "@/lib/baseDatos";

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

function validar(ic: string, ica: string) {
  const idC = Number(ic);
  const idCa = Number(ica);
  if (!Number.isFinite(idC) || idC <= 0 || !Number.isFinite(idCa) || idCa <= 0)
    return null;
  return { idC, idCa };
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idCita } = await params;
  const ids = validar(idCuenta, idCita);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cita = obtenerCita(ids.idCa);
  if (!cita || cita.cuenta_id !== ids.idC) {
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
  if (typeof payload.fecha_iso === "string") {
    const ms = new Date(payload.fecha_iso).getTime();
    if (Number.isFinite(ms)) cambios.fecha_hora = Math.floor(ms / 1000);
  } else if (
    typeof payload.fecha_hora === "number" &&
    Number.isFinite(payload.fecha_hora)
  ) {
    cambios.fecha_hora = Math.floor(payload.fecha_hora);
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

  const actualizada = actualizarCita(ids.idCa, cambios);
  return NextResponse.json({ cita: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idCita } = await params;
  const ids = validar(idCuenta, idCita);
  if (!ids) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }
  const cita = obtenerCita(ids.idCa);
  if (!cita || cita.cuenta_id !== ids.idC) {
    return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
  }
  borrarCita(ids.idCa);
  return NextResponse.json({ ok: true });
}
