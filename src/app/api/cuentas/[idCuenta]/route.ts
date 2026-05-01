import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  archivarCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { calcularBotVivo } from "@/lib/latidoBot";

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
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  return NextResponse.json({
    cuenta: { ...cuenta, bot_vivo: calcularBotVivo(cuenta) },
  });
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let payload: {
    etiqueta?: unknown;
    prompt_sistema?: unknown;
    contexto_negocio?: unknown;
    buffer_segundos?: unknown;
    modelo?: unknown;
    voz_elevenlabs?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const etiqueta =
    typeof payload.etiqueta === "string" ? payload.etiqueta : undefined;
  const prompt =
    typeof payload.prompt_sistema === "string"
      ? payload.prompt_sistema
      : undefined;
  const contexto =
    typeof payload.contexto_negocio === "string"
      ? payload.contexto_negocio
      : undefined;
  const buffer =
    typeof payload.buffer_segundos === "number"
      ? payload.buffer_segundos
      : undefined;
  const modelo =
    typeof payload.modelo === "string"
      ? payload.modelo
      : payload.modelo === null
      ? null
      : undefined;
  const voz =
    typeof payload.voz_elevenlabs === "string"
      ? payload.voz_elevenlabs
      : payload.voz_elevenlabs === null
      ? null
      : undefined;

  const actualizada = actualizarCuenta(id, {
    etiqueta,
    prompt_sistema: prompt,
    contexto_negocio: contexto,
    buffer_segundos: buffer,
    modelo,
    voz_elevenlabs: voz,
  });
  if (!actualizada) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ cuenta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  archivarCuenta(id);
  return NextResponse.json({ ok: true });
}
