import { NextResponse, type NextRequest } from "next/server";
import {
  crearSeguimiento,
  listarSeguimientosDeCuenta,
  obtenerConversacionPorId,
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
  const seguimientos = listarSeguimientosDeCuenta(id);
  return NextResponse.json({ seguimientos });
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
    contenido?: unknown;
    fecha_iso?: unknown;
    programado_para?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const idConv = Number(payload.conversacion_id);
  if (!Number.isFinite(idConv) || idConv <= 0) {
    return NextResponse.json(
      { error: "conversacion_id inválido" },
      { status: 400 },
    );
  }
  const conv = obtenerConversacionPorId(idConv);
  if (!conv || conv.cuenta_id !== id) {
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

  let programadoPara: number;
  if (typeof payload.programado_para === "number") {
    programadoPara = Math.floor(payload.programado_para);
  } else if (typeof payload.fecha_iso === "string") {
    const ms = new Date(payload.fecha_iso).getTime();
    if (!Number.isFinite(ms)) {
      return NextResponse.json(
        { error: "fecha_iso inválida" },
        { status: 400 },
      );
    }
    programadoPara = Math.floor(ms / 1000);
  } else {
    return NextResponse.json(
      { error: "Falta fecha (programado_para o fecha_iso)" },
      { status: 400 },
    );
  }

  const ahora = Math.floor(Date.now() / 1000);
  if (programadoPara < ahora + 60) {
    return NextResponse.json(
      { error: "La fecha debe ser al menos 1 minuto en el futuro" },
      { status: 400 },
    );
  }
  if (programadoPara > ahora + 365 * 86400) {
    return NextResponse.json(
      { error: "La fecha no puede ser mayor a 1 año adelante" },
      { status: 400 },
    );
  }

  const seguimiento = crearSeguimiento(
    id,
    idConv,
    contenido,
    programadoPara,
    "humano",
  );
  return NextResponse.json({ seguimiento }, { status: 201 });
}
