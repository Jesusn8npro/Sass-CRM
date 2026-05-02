import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  archivarCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { calcularBotVivo } from "@/lib/latidoBot";
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
  return NextResponse.json({
    cuenta: { ...cuenta, bot_vivo: calcularBotVivo(cuenta) },
  });
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuentaActual = await obtenerCuenta(idCuenta);
  if (!cuentaActual || cuentaActual.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: {
    etiqueta?: unknown;
    prompt_sistema?: unknown;
    contexto_negocio?: unknown;
    buffer_segundos?: unknown;
    modelo?: unknown;
    voz_elevenlabs?: unknown;
    vapi_api_key?: unknown;
    vapi_assistant_id?: unknown;
    vapi_phone_id?: unknown;
    vapi_prompt_extra?: unknown;
    vapi_primer_mensaje?: unknown;
    vapi_max_segundos?: unknown;
    vapi_grabar?: unknown;
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
  const vapiKey =
    typeof payload.vapi_api_key === "string"
      ? payload.vapi_api_key
      : payload.vapi_api_key === null
      ? null
      : undefined;
  const vapiAssistant =
    typeof payload.vapi_assistant_id === "string"
      ? payload.vapi_assistant_id
      : payload.vapi_assistant_id === null
      ? null
      : undefined;
  const vapiPhone =
    typeof payload.vapi_phone_id === "string"
      ? payload.vapi_phone_id
      : payload.vapi_phone_id === null
      ? null
      : undefined;
  const vapiPromptExtra =
    typeof payload.vapi_prompt_extra === "string"
      ? payload.vapi_prompt_extra
      : payload.vapi_prompt_extra === null
      ? null
      : undefined;
  const vapiPrimerMsg =
    typeof payload.vapi_primer_mensaje === "string"
      ? payload.vapi_primer_mensaje
      : payload.vapi_primer_mensaje === null
      ? null
      : undefined;
  const vapiMaxSeg =
    typeof payload.vapi_max_segundos === "number"
      ? Math.max(30, Math.min(3600, Math.floor(payload.vapi_max_segundos)))
      : payload.vapi_max_segundos === null
      ? null
      : undefined;
  const vapiGrabar =
    typeof payload.vapi_grabar === "boolean" ? payload.vapi_grabar : undefined;

  const actualizada = await actualizarCuenta(idCuenta, {
    etiqueta,
    prompt_sistema: prompt,
    contexto_negocio: contexto,
    buffer_segundos: buffer,
    modelo,
    voz_elevenlabs: voz,
    vapi_api_key: vapiKey,
    vapi_assistant_id: vapiAssistant,
    vapi_phone_id: vapiPhone,
    vapi_prompt_extra: vapiPromptExtra,
    vapi_primer_mensaje: vapiPrimerMsg,
    vapi_max_segundos: vapiMaxSeg,
    vapi_grabar: vapiGrabar,
  });
  if (!actualizada) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ cuenta: actualizada });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
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
  await archivarCuenta(idCuenta);
  return NextResponse.json({ ok: true });
}
