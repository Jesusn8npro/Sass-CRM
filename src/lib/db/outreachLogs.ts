/**
 * Funciones de DB para los registros del pipeline de prospección.
 * Tablas: prospeccion_llamadas, prospeccion_emails
 * (creadas en migrations/22_outreach.sql, renombradas en 23_renombrar_prospeccion.sql)
 */
import { db, lanzar } from "./cliente";

// ============================================================
// Tipos
// ============================================================

export interface RegistroLlamadaProspeccion {
  id: string;
  cuenta_id: string;
  lead_id: string;
  vapi_call_id: string | null;
  resultado: string | null;
  transcripcion: string | null;
  url_grabacion: string | null;
  duracion_segundos: number | null;
  costo_usd: number | null;
  resumen: string | null;
  creado_en: string;
}

/** @deprecated Usar RegistroLlamadaProspeccion */
export type OutreachCallLog = RegistroLlamadaProspeccion;

export interface InputRegistroLlamada {
  cuenta_id: string;
  lead_id: string;
  vapi_call_id?: string | null;
  resultado?: string | null;
}

/** @deprecated Usar InputRegistroLlamada */
export type InputOutreachCallLog = InputRegistroLlamada;

export interface RegistroEmailProspeccion {
  id: string;
  cuenta_id: string;
  lead_id: string;
  resend_message_id: string | null;
  paso: 1 | 2 | 3;
  estado_envio: "pendiente" | "enviado" | "entregado" | "rebotado" | "spam" | "fallido";
  programado_para: string | null;
  enviado_en: string | null;
  creado_en: string;
}

/** @deprecated Usar RegistroEmailProspeccion */
export type OutreachEmailLog = RegistroEmailProspeccion;

export interface InputRegistroEmail {
  cuenta_id: string;
  lead_id: string;
  resend_message_id?: string | null;
  paso: 1 | 2 | 3;
  estado_envio?: RegistroEmailProspeccion["estado_envio"];
  programado_para?: string | null;
  enviado_en?: string | null;
}

/** @deprecated Usar InputRegistroEmail */
export type InputOutreachEmailLog = InputRegistroEmail;

// ============================================================
// prospeccion_llamadas
// ============================================================

/** Crea un registro de llamada de prospección. Devuelve el id generado. */
export async function insertarRegistroLlamada(
  data: InputRegistroLlamada,
): Promise<string> {
  const { data: fila, error } = await db()
    .from("prospeccion_llamadas")
    .insert(data)
    .select("id")
    .single();
  if (error) lanzar(error, "insertarRegistroLlamada");
  return (fila as { id: string }).id;
}

/** @deprecated Usar insertarRegistroLlamada */
export const insertarOutreachCallLog = insertarRegistroLlamada;

/** Actualiza el resultado de una llamada cuando llega el webhook de Vapi. */
export async function actualizarRegistroLlamadaPorVapiId(
  vapiCallId: string,
  datos: {
    resultado?: string | null;
    transcripcion?: string | null;
    url_grabacion?: string | null;
    duracion_segundos?: number | null;
    costo_usd?: number | null;
    resumen?: string | null;
  },
): Promise<void> {
  const { error } = await db()
    .from("prospeccion_llamadas")
    .update(datos)
    .eq("vapi_call_id", vapiCallId);
  if (error) lanzar(error, "actualizarRegistroLlamadaPorVapiId");
}

/** @deprecated Usar actualizarRegistroLlamadaPorVapiId */
export const actualizarOutreachCallLogPorVapiId = actualizarRegistroLlamadaPorVapiId;

/** Busca un registro de llamada por vapi_call_id. Útil en el webhook. */
export async function obtenerRegistroLlamadaPorVapiId(
  vapiCallId: string,
): Promise<RegistroLlamadaProspeccion | null> {
  const { data, error } = await db()
    .from("prospeccion_llamadas")
    .select("*")
    .eq("vapi_call_id", vapiCallId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerRegistroLlamadaPorVapiId");
  return (data as RegistroLlamadaProspeccion) ?? null;
}

/** @deprecated Usar obtenerRegistroLlamadaPorVapiId */
export const obtenerOutreachCallLogPorVapiId = obtenerRegistroLlamadaPorVapiId;

/**
 * Cuenta cuántas llamadas de prospección se hicieron en la última hora para una cuenta.
 * El orquestador usa esto para respetar el límite de llamadas/hora.
 */
export async function contarLlamadasProspeccionUltimaHora(
  cuentaId: string,
): Promise<number> {
  const hace1hora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await db()
    .from("prospeccion_llamadas")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .gte("creado_en", hace1hora);
  if (error) lanzar(error, "contarLlamadasProspeccionUltimaHora");
  return count ?? 0;
}

/** @deprecated Usar contarLlamadasProspeccionUltimaHora */
export const contarLlamadasOutreachUltimaHora = contarLlamadasProspeccionUltimaHora;

/** Lista los últimos registros de llamadas de prospección de una cuenta. */
export async function listarLlamadasProspeccion(
  cuentaId: string,
  limite = 50,
): Promise<RegistroLlamadaProspeccion[]> {
  const { data, error } = await db()
    .from("prospeccion_llamadas")
    .select(`
      *,
      leads_extraidos(nombre, telefono, categoria, direccion)
    `)
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarLlamadasProspeccion");
  return (data ?? []) as RegistroLlamadaProspeccion[];
}

/** @deprecated Usar listarLlamadasProspeccion */
export const listarOutreachCallLogs = listarLlamadasProspeccion;

// ============================================================
// prospeccion_emails
// ============================================================

/** Crea un registro de email de prospección. Devuelve el id generado. */
export async function insertarRegistroEmail(
  data: InputRegistroEmail,
): Promise<string> {
  const payload = {
    ...data,
    ...(data.estado_envio === "enviado" && !data.enviado_en
      ? { enviado_en: new Date().toISOString() }
      : {}),
  };
  const { data: fila, error } = await db()
    .from("prospeccion_emails")
    .insert(payload)
    .select("id")
    .single();
  if (error) lanzar(error, "insertarRegistroEmail");
  return (fila as { id: string }).id;
}

/** @deprecated Usar insertarRegistroEmail */
export const insertarOutreachEmailLog = insertarRegistroEmail;

/** Actualiza el estado de un email cuando llega el webhook de Resend. */
export async function actualizarEmailProspeccionPorResendId(
  resendMessageId: string,
  estado: RegistroEmailProspeccion["estado_envio"],
): Promise<void> {
  const { error } = await db()
    .from("prospeccion_emails")
    .update({ estado_envio: estado })
    .eq("resend_message_id", resendMessageId);
  if (error) lanzar(error, "actualizarEmailProspeccionPorResendId");
}

/** @deprecated Usar actualizarEmailProspeccionPorResendId */
export const actualizarOutreachEmailLogPorResendId = actualizarEmailProspeccionPorResendId;

/**
 * Devuelve los registros de email con paso 2 o 3 cuya fecha programada ya pasó
 * y estado es 'pendiente'. El orquestador los procesa cada 5 minutos.
 */
export async function obtenerEmailsProspeccionPendientes(
  cuentaId?: string,
): Promise<RegistroEmailProspeccion[]> {
  let query = db()
    .from("prospeccion_emails")
    .select("*")
    .in("paso", [2, 3])
    .eq("estado_envio", "pendiente")
    .lte("programado_para", new Date().toISOString())
    .order("programado_para", { ascending: true })
    .limit(50);

  if (cuentaId) {
    query = query.eq("cuenta_id", cuentaId);
  }

  const { data, error } = await query;
  if (error) lanzar(error, "obtenerEmailsProspeccionPendientes");
  return (data ?? []) as RegistroEmailProspeccion[];
}

/** @deprecated Usar obtenerEmailsProspeccionPendientes */
export const obtenerEmailsOutreachPendientes = obtenerEmailsProspeccionPendientes;

/** Marca un email como enviado (lo llama el orquestador al despachar paso 2/3). */
export async function marcarEmailProspeccionEnviado(
  id: string,
  resendMessageId: string,
): Promise<void> {
  const { error } = await db()
    .from("prospeccion_emails")
    .update({
      estado_envio: "enviado",
      resend_message_id: resendMessageId,
      enviado_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) lanzar(error, "marcarEmailProspeccionEnviado");
}

/** @deprecated Usar marcarEmailProspeccionEnviado */
export const marcarEmailOutreachEnviado = marcarEmailProspeccionEnviado;

/** ¿Ya se envió el paso N para este lead? Evita duplicados. */
export async function existeEmailProspeccionPaso(
  leadId: string,
  paso: 1 | 2 | 3,
): Promise<boolean> {
  const { count, error } = await db()
    .from("prospeccion_emails")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("paso", paso);
  if (error) lanzar(error, "existeEmailProspeccionPaso");
  return (count ?? 0) > 0;
}

/** @deprecated Usar existeEmailProspeccionPaso */
export const existeEmailOutreachPaso = existeEmailProspeccionPaso;

/** Lista los registros de emails de prospección de una cuenta con datos del lead. */
export async function listarEmailsProspeccion(
  cuentaId: string,
  limite = 50,
): Promise<RegistroEmailProspeccion[]> {
  const { data, error } = await db()
    .from("prospeccion_emails")
    .select(`
      *,
      leads_extraidos(nombre, email, categoria)
    `)
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarEmailsProspeccion");
  return (data ?? []) as RegistroEmailProspeccion[];
}
