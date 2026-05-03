import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  archivarCuenta,
  obtenerCuenta,
  type CampoCaptura,
} from "@/lib/baseDatos";
import { calcularBotVivo } from "@/lib/latidoBot";
import { requerirSesion } from "@/lib/auth/sesion";

/** Sanea la lista de campos a capturar que viene del cliente.
 * Filtra los inválidos en lugar de fallar — más amistoso para la UI. */
function sanearCamposCaptura(input: unknown): CampoCaptura[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: CampoCaptura[] = [];
  const clavesUsadas = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const claveRaw = typeof r.clave === "string" ? r.clave : "";
    // slug: minúsculas, alfanumérico + underscore
    const clave = claveRaw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    if (!clave || clavesUsadas.has(clave)) continue;
    clavesUsadas.add(clave);
    const label =
      typeof r.label === "string" ? r.label.trim().slice(0, 60) : clave;
    const descripcion =
      typeof r.descripcion === "string"
        ? r.descripcion.trim().slice(0, 280)
        : "";
    const obligatorio = r.obligatorio === true;
    const pregunta_sugerida =
      typeof r.pregunta_sugerida === "string"
        ? r.pregunta_sugerida.trim().slice(0, 280)
        : "";
    const orden =
      typeof r.orden === "number" && Number.isFinite(r.orden)
        ? Math.max(1, Math.min(999, Math.floor(r.orden)))
        : 100;
    out.push({
      clave,
      label: label || clave,
      descripcion,
      obligatorio,
      pregunta_sugerida,
      orden,
    });
    if (out.length >= 30) break; // tope sano para no inflar el prompt
  }
  // Ordenamos por `orden` para que el orden lógico de captura sea
  // estable y predecible para la IA.
  out.sort((a, b) => (a.orden ?? 100) - (b.orden ?? 100));
  return out;
}

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
    vapi_public_key?: unknown;
    vapi_assistant_id?: unknown;
    vapi_phone_id?: unknown;
    vapi_prompt_extra?: unknown;
    vapi_primer_mensaje?: unknown;
    vapi_max_segundos?: unknown;
    vapi_grabar?: unknown;
    campos_a_capturar?: unknown;
    agente_nombre?: unknown;
    agente_rol?: unknown;
    agente_personalidad?: unknown;
    agente_idioma?: unknown;
    agente_tono?: unknown;
    mensaje_bienvenida?: unknown;
    mensaje_no_entiende?: unknown;
    palabras_handoff?: unknown;
    temperatura?: unknown;
    max_tokens?: unknown;
    instrucciones_extra?: unknown;
    modo_respuesta?: unknown;
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
  const vapiPublicKey =
    typeof payload.vapi_public_key === "string"
      ? payload.vapi_public_key
      : payload.vapi_public_key === null
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
  const camposCaptura = sanearCamposCaptura(payload.campos_a_capturar);

  // Campos del agente IA estructurados
  const agente_nombre =
    typeof payload.agente_nombre === "string"
      ? payload.agente_nombre.trim().slice(0, 60)
      : undefined;
  const agente_rol =
    typeof payload.agente_rol === "string"
      ? payload.agente_rol.trim().slice(0, 80)
      : undefined;
  const agente_personalidad =
    typeof payload.agente_personalidad === "string"
      ? payload.agente_personalidad.trim().slice(0, 200)
      : undefined;
  const agente_idioma =
    typeof payload.agente_idioma === "string"
      ? payload.agente_idioma.trim().slice(0, 8)
      : undefined;
  const TONOS_VALIDOS = [
    "formal",
    "casual_amigable",
    "profesional",
    "cercano",
    "directo",
    "consultivo",
  ] as const;
  const tonoStr =
    typeof payload.agente_tono === "string" ? payload.agente_tono : "";
  const agente_tono = (TONOS_VALIDOS as readonly string[]).includes(tonoStr)
    ? (tonoStr as (typeof TONOS_VALIDOS)[number])
    : undefined;
  const mensaje_bienvenida =
    typeof payload.mensaje_bienvenida === "string"
      ? payload.mensaje_bienvenida.slice(0, 800)
      : undefined;
  const mensaje_no_entiende =
    typeof payload.mensaje_no_entiende === "string"
      ? payload.mensaje_no_entiende.slice(0, 400)
      : undefined;
  const palabras_handoff =
    typeof payload.palabras_handoff === "string"
      ? payload.palabras_handoff.slice(0, 600)
      : undefined;
  const temperatura =
    typeof payload.temperatura === "number" && Number.isFinite(payload.temperatura)
      ? Math.max(0, Math.min(2, payload.temperatura))
      : undefined;
  const max_tokens =
    typeof payload.max_tokens === "number" && Number.isFinite(payload.max_tokens)
      ? Math.max(100, Math.min(8000, Math.floor(payload.max_tokens)))
      : undefined;
  const instrucciones_extra =
    typeof payload.instrucciones_extra === "string"
      ? payload.instrucciones_extra.slice(0, 4000)
      : undefined;
  const MODOS_RESP = ["mixto", "solo_texto", "solo_audio", "espejo_voz"] as const;
  const modo_respuesta =
    typeof payload.modo_respuesta === "string" &&
    (MODOS_RESP as readonly string[]).includes(payload.modo_respuesta)
      ? (payload.modo_respuesta as (typeof MODOS_RESP)[number])
      : undefined;

  const actualizada = await actualizarCuenta(idCuenta, {
    etiqueta,
    prompt_sistema: prompt,
    contexto_negocio: contexto,
    buffer_segundos: buffer,
    modelo,
    voz_elevenlabs: voz,
    vapi_api_key: vapiKey,
    vapi_public_key: vapiPublicKey,
    vapi_assistant_id: vapiAssistant,
    vapi_phone_id: vapiPhone,
    vapi_prompt_extra: vapiPromptExtra,
    vapi_primer_mensaje: vapiPrimerMsg,
    vapi_max_segundos: vapiMaxSeg,
    vapi_grabar: vapiGrabar,
    campos_a_capturar: camposCaptura,
    agente_nombre,
    agente_rol,
    agente_personalidad,
    agente_idioma,
    agente_tono,
    mensaje_bienvenida,
    mensaje_no_entiende,
    palabras_handoff,
    temperatura,
    max_tokens,
    instrucciones_extra,
    modo_respuesta,
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
