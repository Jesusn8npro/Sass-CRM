import { db, lanzar } from "./cliente";
import { PROMPT_SISTEMA_DEFAULT } from "../promptSistema";
import { sembrarEtapasSiVacias } from "./etapas";
import type { CampoCaptura, Cuenta, EstadoConexion } from "./tipos";

/**
 * Lista las cuentas de un usuario (excluye archivadas).
 * Si no se pasa usuarioId, lista TODAS (uso interno del bot).
 */
export async function listarCuentas(usuarioId?: string): Promise<Cuenta[]> {
  let q = db()
    .from("cuentas")
    .select("*")
    .eq("esta_archivada", false)
    .order("creada_en", { ascending: true });
  if (usuarioId) q = q.eq("usuario_id", usuarioId);
  const { data, error } = await q;
  if (error) lanzar(error, "listarCuentas");
  return (data ?? []) as Cuenta[];
}

export async function obtenerCuenta(id: string): Promise<Cuenta | null> {
  const { data, error } = await db()
    .from("cuentas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCuenta");
  return (data as Cuenta) ?? null;
}

export async function crearCuenta(
  usuarioId: string,
  etiqueta: string,
  promptSistema?: string | null,
  modelo?: string | null,
): Promise<Cuenta> {
  const prompt = promptSistema?.trim() || PROMPT_SISTEMA_DEFAULT;
  const { data, error } = await db()
    .from("cuentas")
    .insert({
      usuario_id: usuarioId,
      etiqueta: etiqueta.trim(),
      prompt_sistema: prompt,
      modelo: modelo ?? null,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearCuenta");
  await sembrarEtapasSiVacias((data as Cuenta).id);
  return data as Cuenta;
}

export async function actualizarCuenta(
  id: string,
  parametros: Partial<{
    etiqueta: string;
    prompt_sistema: string;
    contexto_negocio: string;
    buffer_segundos: number;
    modelo: string | null;
    voz_elevenlabs: string | null;
    vapi_api_key: string | null;
    vapi_public_key: string | null;
    vapi_assistant_id: string | null;
    vapi_phone_id: string | null;
    vapi_webhook_secret: string | null;
    vapi_prompt_extra: string | null;
    vapi_primer_mensaje: string | null;
    vapi_max_segundos: number | null;
    vapi_grabar: boolean;
    vapi_sincronizado_en: string | null;
    campos_a_capturar: CampoCaptura[];
    agente_nombre: string;
    agente_rol: string;
    agente_personalidad: string;
    agente_idioma: string;
    agente_tono: Cuenta["agente_tono"];
    mensaje_bienvenida: string;
    mensaje_no_entiende: string;
    palabras_handoff: string;
    temperatura: number;
    max_tokens: number;
    instrucciones_extra: string;
    modo_respuesta: Cuenta["modo_respuesta"];
    wa_phone_number_id: string | null;
    wa_business_account_id: string | null;
    wa_access_token: string | null;
    wa_verify_token: string | null;
    wa_app_secret: string | null;
    wa_estado: "desconectado" | "verificando" | "conectado" | "error";
    wa_verificada_en: string | null;
    wa_ultimo_error: string | null;
    auto_seguimiento_activo: boolean;
  }>,
): Promise<Cuenta | null> {
  const cambios: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parametros)) {
    if (v !== undefined) cambios[k] = v;
  }
  if (cambios.buffer_segundos !== undefined) {
    cambios.buffer_segundos = Math.max(
      0,
      Math.min(120, Math.floor(cambios.buffer_segundos as number)),
    );
  }
  if (cambios.etiqueta !== undefined) {
    cambios.etiqueta = (cambios.etiqueta as string).trim();
  }
  if (Object.keys(cambios).length === 0) return obtenerCuenta(id);
  const { data, error } = await db()
    .from("cuentas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarCuenta");
  return data as Cuenta;
}

export async function archivarCuenta(id: string): Promise<void> {
  const { error } = await db()
    .from("cuentas")
    .update({ esta_archivada: true })
    .eq("id", id);
  if (error) lanzar(error, "archivarCuenta");
}

export async function actualizarEstadoCuenta(
  id: string,
  parametros: {
    estado: EstadoConexion;
    cadena_qr?: string | null;
    telefono?: string | null;
  },
): Promise<void> {
  const cambios: Record<string, unknown> = { estado: parametros.estado };
  if (Object.prototype.hasOwnProperty.call(parametros, "cadena_qr")) {
    cambios.cadena_qr = parametros.cadena_qr ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(parametros, "telefono")) {
    cambios.telefono = parametros.telefono ?? null;
  }
  const { error } = await db().from("cuentas").update(cambios).eq("id", id);
  if (error) lanzar(error, "actualizarEstadoCuenta");
}

export async function actualizarHeartbeatCuenta(id: string): Promise<void> {
  const { error } = await db()
    .from("cuentas")
    .update({ ultimo_heartbeat: Math.floor(Date.now() / 1000) })
    .eq("id", id);
  if (error) lanzar(error, "actualizarHeartbeatCuenta");
}
