import { NextResponse, type NextRequest } from "next/server";
import {
  crearSeguimiento,
  listarSeguimientosDeCuenta,
  obtenerConversacionPorId,
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
  const seguimientos = await listarSeguimientosDeCuenta(idCuenta);
  return NextResponse.json({ seguimientos });
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
    contenido?: unknown;
    fecha_iso?: unknown;
    programado_para?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const idConv =
    typeof payload.conversacion_id === "string" && payload.conversacion_id
      ? payload.conversacion_id
      : "";
  if (!idConv) {
    return NextResponse.json(
      { error: "conversacion_id inválido" },
      { status: 400 },
    );
  }
  const conv = await obtenerConversacionPorId(idConv);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const contenido =
    typeof payload.contenido === "string" ? payload.contenido.trim() : "";
  if (!contenido) {
    return NextResponse.json(
      { error: "El contenido del mensaje es obligatorio" },
      { status: 400 },
    );
  }
  if (contenido.length > 2000) {
    return NextResponse.json(
      { error: "Contenido muy largo (máx 2000 chars)" },
      { status: 400 },
    );
  }

  // Acepta programado_para o fecha_iso como ISO string del cliente.
  const fechaRaw =
    typeof payload.programado_para === "string"
      ? payload.programado_para
      : typeof payload.fecha_iso === "string"
      ? payload.fecha_iso
      : null;
  if (!fechaRaw) {
    return NextResponse.json(
      { error: "Falta fecha (programado_para o fecha_iso)" },
      { status: 400 },
    );
  }
  const ms = new Date(fechaRaw).getTime();
  if (!Number.isFinite(ms)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const ahoraMs = Date.now();
  if (ms < ahoraMs + 60_000) {
    return NextResponse.json(
      { error: "La fecha debe ser al menos 1 minuto en el futuro" },
      { status: 400 },
    );
  }
  if (ms > ahoraMs + 365 * 86400 * 1000) {
    return NextResponse.json(
      { error: "La fecha no puede ser mayor a 1 año adelante" },
      { status: 400 },
    );
  }
  const programadoPara = new Date(ms).toISOString();

  const seguimiento = await crearSeguimiento(
    idCuenta,
    idConv,
    contenido,
    programadoPara,
    "humano",
  );
  return NextResponse.json({ seguimiento }, { status: 201 });
}
