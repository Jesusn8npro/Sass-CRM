/**
 * baseDatos.ts — Capa de acceso a datos sobre Supabase Postgres.
 *
 * Reemplaza la versión SQLite (better-sqlite3) por el cliente admin
 * de Supabase. La API pública mantiene los mismos nombres de funciones
 * pero ahora son ASYNC y los IDs son STRING (UUIDs) en lugar de number.
 *
 * Por qué admin client (service_role):
 *   El bot corre en el servidor sin sesión de usuario. Necesita acceso
 *   completo a las tablas (lee/escribe mensajes de cualquier cuenta) para
 *   procesar WhatsApp en tiempo real. Las APIs llamadas desde el browser
 *   verifican propiedad ANTES de llamar a estas funciones (ver
 *   src/lib/auth/sesion.ts).
 *
 * Convenciones:
 *   - IDs son UUIDs (string).
 *   - Timestamps son strings ISO 8601 (timestamptz de Postgres).
 *   - Para comparar timestamps usar `new Date(s).getTime()`.
 */

import { crearClienteAdmin } from "./supabase/cliente-servidor";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Tipos
// ============================================================
export type ModoConversacion = "IA" | "HUMANO";
export type RolMensaje = "usuario" | "asistente" | "humano" | "sistema";
export type TipoMensaje =
  | "texto"
  | "audio"
  | "imagen"
  | "video"
  | "documento"
  | "sistema";
export type EstadoConexion =
  | "desconectado"
  | "qr"
  | "conectando"
  | "conectado";
export type EstadoLlamada =
  | "iniciando"
  | "sonando"
  | "en_curso"
  | "completada"
  | "sin_respuesta"
  | "fallida"
  | "finalizada";
export type ValidezEmail = "valido" | "sospechoso" | "invalido";
export type TipoMediaBiblioteca = "imagen" | "video" | "audio" | "documento";
export type EstadoSeguimiento =
  | "pendiente"
  | "enviado"
  | "cancelado"
  | "fallido";
export type EstadoCita =
  | "agendada"
  | "confirmada"
  | "realizada"
  | "cancelada"
  | "no_asistio";

/** Campo extra que el dueño quiere que la IA capture del cliente.
 * Se inyectan al prompt para guiar al agente. La IA los guarda en
 * datos_capturados.otros con la clave indicada. */
export interface CampoCaptura {
  clave: string; // slug interno: "ciudad", "presupuesto", "equipo"
  label: string; // visible en /clientes: "Ciudad", "Presupuesto"
  descripcion: string; // pista para la IA: "Ciudad donde vive el cliente"
  obligatorio: boolean;
  /** Pregunta natural sugerida que la IA usa como referencia para pedir
   * este dato. Ejemplo: "¿En qué ciudad estás organizando el evento?".
   * Si está vacía, la IA improvisa con la descripción. */
  pregunta_sugerida?: string;
  /** Orden de captura preferido por el dueño (1, 2, 3...). La IA usa
   * esto como guía de qué pedir primero. Default 100 = sin preferencia. */
  orden?: number;
}

export interface Cuenta {
  id: string;
  usuario_id: string;
  etiqueta: string;
  telefono: string | null;
  estado: EstadoConexion;
  cadena_qr: string | null;
  ultimo_heartbeat: number | null;
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
  // ===== Identidad y estilo del agente (estructurado) =====
  agente_nombre: string;
  agente_rol: string;
  agente_personalidad: string;
  agente_idioma: string;
  agente_tono:
    | "formal"
    | "casual_amigable"
    | "profesional"
    | "cercano"
    | "directo"
    | "consultivo";
  // ===== Mensajes predefinidos =====
  mensaje_bienvenida: string;
  mensaje_no_entiende: string;
  /** Lista CSV de palabras/frases que activan handoff inmediato a humano. */
  palabras_handoff: string;
  // ===== Parámetros técnicos del modelo =====
  temperatura: number;
  max_tokens: number;
  instrucciones_extra: string;
  // ===== WhatsApp Business Cloud API (Meta) =====
  // Independiente de los campos Baileys (estado, cadena_qr) — esta es la
  // integración oficial via Meta Graph API. Si están seteados estos campos
  // y wa_estado='conectado', la cuenta usa Meta Cloud en vez de Baileys.
  wa_phone_number_id: string | null;
  wa_business_account_id: string | null;
  wa_access_token: string | null;
  wa_verify_token: string | null;
  wa_app_secret: string | null;
  wa_estado: "desconectado" | "verificando" | "conectado" | "error";
  wa_verificada_en: string | null;
  wa_ultimo_error: string | null;
  esta_activa: boolean;
  esta_archivada: boolean;
  creada_en: string;
  actualizada_en: string;
}

export interface EtiquetaResumen {
  id: string;
  nombre: string;
  color: string;
}

export type EstadoLead =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "interesado"
  | "negociacion"
  | "cerrado"
  | "perdido";

/** Campos que la IA captura del cliente conversación a conversación.
 * Es JSONB libre — la IA puede agregar campos en `otros` cuando aparezcan
 * datos relevantes que no encajan en los predefinidos. */
export interface DatosCapturados {
  nombre?: string | null;
  email?: string | null;
  telefono_alt?: string | null;
  interes?: string | null;
  negocio?: string | null;
  ventajas?: string | null;
  miedos?: string | null;
  otros?: Record<string, string> | null;
}

export interface Conversacion {
  id: string;
  cuenta_id: string;
  telefono: string;
  jid_wa: string | null;
  nombre: string | null;
  modo: ModoConversacion;
  necesita_humano: boolean;
  etapa_id: string | null;
  ultimo_mensaje_en: string | null;
  ultimo_visto_operador_en: string | null;
  creada_en: string;
  lead_score: number;
  estado_lead: EstadoLead;
  paso_actual: string;
  datos_capturados: DatosCapturados;
}

export interface ConversacionConPreview extends Conversacion {
  vista_previa_ultimo_mensaje: string | null;
  /** Rol del último mensaje (para decidir prefix "Tu: " en la lista). */
  vista_previa_rol: RolMensaje | null;
  /** Cuántos mensajes del cliente (rol='usuario') llegaron DESPUÉS de
   * la última vez que el operador abrió esta conversación en el panel.
   * Se resetea a 0 cuando el operador hace click en la conv (vía
   * marcarConversacionComoLeida). Igual que el badge de WhatsApp. */
  mensajes_nuevos: number;
  etiquetas: EtiquetaResumen[];
}

export interface Mensaje {
  id: string;
  cuenta_id: string;
  conversacion_id: string;
  rol: RolMensaje;
  tipo: TipoMensaje;
  contenido: string;
  media_path: string | null;
  creado_en: string;
  wa_msg_id: string | null;
}

export interface FilaBandejaSalida {
  id: string;
  cuenta_id: string;
  conversacion_id: string;
  telefono: string;
  tipo: TipoMensaje;
  contenido: string;
  media_path: string | null;
  enviado: boolean;
  creado_en: string;
}

export interface EntradaConocimiento {
  id: string;
  cuenta_id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  esta_activo: boolean;
  orden: number;
  creada_en: string;
  actualizada_en: string;
}

export interface RespuestaRapida {
  id: string;
  cuenta_id: string;
  atajo: string;
  texto: string;
  orden: number;
  creada_en: string;
  actualizada_en: string;
}

export interface Etiqueta {
  id: string;
  cuenta_id: string;
  nombre: string;
  color: string;
  descripcion: string | null;
  orden: number;
  creada_en: string;
}

export interface EtiquetaConCount extends Etiqueta {
  conversaciones_count: number;
}

export interface MedioBiblioteca {
  id: string;
  cuenta_id: string;
  identificador: string;
  tipo: TipoMediaBiblioteca;
  ruta_archivo: string;
  descripcion: string;
  creado_en: string;
}

export interface EtapaPipeline {
  id: string;
  cuenta_id: string;
  nombre: string;
  color: string;
  orden: number;
  creada_en: string;
}

export interface ContactoEmail {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  email: string;
  validez: ValidezEmail;
  capturado_en: string;
}

export interface ContactoEmailConTelefono extends ContactoEmail {
  nombre_contacto: string | null;
  telefono: string | null;
}

export interface ContactoTelefono {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  telefono: string;
  capturado_en: string;
}

export interface ContactoTelefonoConContexto extends ContactoTelefono {
  nombre_contacto: string | null;
  telefono_conv: string | null;
}

export interface Producto {
  id: string;
  cuenta_id: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  moneda: string;
  costo: number | null;
  stock: number | null;
  sku: string | null;
  categoria: string | null;
  imagen_path: string | null;
  video_path: string | null;
  esta_activo: boolean;
  orden: number;
  creada_en: string;
  actualizada_en: string;
}

export interface InteresProducto {
  conversacion_id: string;
  producto_id: string;
  cuenta_id: string;
  ultimo_interes_en: string;
  veces: number;
}

export interface InteresConProducto extends InteresProducto {
  nombre: string;
  precio: number | null;
  moneda: string;
  imagen_path: string | null;
  stock: number | null;
}

export interface InteresadoEnProducto extends InteresProducto {
  nombre_contacto: string | null;
  telefono: string;
  modo: ModoConversacion;
  necesita_humano: boolean;
}

export interface ProductoTop {
  id: string;
  nombre: string;
  precio: number | null;
  moneda: string;
  stock: number | null;
  conversaciones_interesadas: number;
  total_menciones: number;
}

export interface Inversion {
  id: string;
  cuenta_id: string;
  concepto: string;
  monto: number;
  moneda: string;
  categoria: string | null;
  fecha: string;
  notas: string | null;
  creada_en: string;
}

export interface ResumenInversiones {
  por_moneda: Array<{ moneda: string; total: number; n: number }>;
  por_categoria: Array<{
    categoria: string;
    moneda: string;
    total: number;
    n: number;
  }>;
}

export interface SeguimientoProgramado {
  id: string;
  cuenta_id: string;
  conversacion_id: string;
  contenido: string;
  programado_para: string;
  estado: EstadoSeguimiento;
  origen: "humano" | "ia";
  razon_cancelacion: string | null;
  enviado_en: string | null;
  creado_en: string;
}

export interface SeguimientoConContacto extends SeguimientoProgramado {
  nombre_contacto: string | null;
  telefono: string | null;
}

export interface Cita {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  fecha_hora: string;
  duracion_min: number;
  tipo: string | null;
  estado: EstadoCita;
  notas: string | null;
  recordatorio_enviado: boolean;
  creada_en: string;
}

export interface LlamadaVapi {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  vapi_call_id: string;
  telefono: string;
  direccion: "saliente" | "entrante";
  estado: EstadoLlamada;
  transcripcion: string | null;
  resumen: string | null;
  audio_url: string | null;
  duracion_seg: number | null;
  costo_usd: number | null;
  iniciada_en: string;
  terminada_en: string | null;
}

export type TipoNotificacion =
  | "cuenta_desconectada"
  | "cuenta_qr_listo"
  | "llamada_fallida"
  | "limite_plan_alcanzado"
  | "sistema";

export interface NotificacionSistema {
  id: string;
  usuario_id: string;
  cuenta_id: string | null;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  metadata: Record<string, unknown> | null;
  leida: boolean;
  email_enviado: boolean;
  creada_en: string;
  leida_en: string | null;
}

export interface AssistantVapi {
  id: string;
  cuenta_id: string;
  nombre: string;
  vapi_assistant_id: string | null;
  prompt_extra: string;
  primer_mensaje: string;
  voz_elevenlabs: string | null;
  modelo: string;
  max_segundos: number;
  grabar: boolean;
  es_default: boolean;
  esta_activo: boolean;
  sincronizado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export type EstadoLlamadaProgramada =
  | "pendiente"
  | "ejecutada"
  | "cancelada"
  | "fallida";

export interface LlamadaProgramada {
  id: string;
  cuenta_id: string;
  conversacion_id: string | null;
  assistant_id: string | null;
  telefono_destino: string | null;
  motivo: string | null;
  origen: "humano" | "ia";
  programada_para: string;
  estado: EstadoLlamadaProgramada;
  llamada_vapi_id: string | null;
  razon_cancelacion: string | null;
  ejecutada_en: string | null;
  creada_en: string;
  actualizada_en: string;
}

export interface LlamadaProgramadaConContexto extends LlamadaProgramada {
  nombre_contacto: string | null;
  telefono_conv: string | null;
  assistant_nombre: string | null;
}

export interface MetricasCuenta {
  conversaciones_total: number;
  conversaciones_necesitan_humano: number;
  conversaciones_modo_ia: number;
  conversaciones_modo_humano: number;
  mensajes_total: number;
  mensajes_recibidos: number;
  mensajes_enviados_bot: number;
  mensajes_enviados_humano: number;
  mensajes_hoy: number;
  mensajes_ultimos_7d: number;
  emails_capturados: number;
  telefonos_capturados: number;
  productos_total: number;
  productos_sin_stock: number;
  inversiones_por_moneda: Array<{ moneda: string; total: number; n: number }>;
  productos_top: ProductoTop[];
  por_etapa: Array<{
    etapa_id: string | null;
    nombre: string;
    color: string;
    count: number;
  }>;
  por_etiqueta: Array<{
    etiqueta_id: string;
    nombre: string;
    color: string;
    count: number;
  }>;
  mensajes_por_dia: Array<{ dia: string; count: number }>;

  // ===== CRM / Lead tracking =====
  por_estado_lead: Array<{
    estado: EstadoLead;
    count: number;
  }>;
  lead_score_promedio: number; // 0-100 promedio sobre todas las conversaciones
  /** Leads "calientes": en negociación o con score >= 75. Clientes que
   * están a punto de cerrar. */
  casi_a_confirmar: number;
  /** Tasa de aceptación: cerrados / (cerrados + perdidos). 0 si no hay
   * decisiones aún. Útil para medir performance del agente. */
  tasa_aceptacion: number;
  /** Conversaciones marcadas con `necesita_humano` que requieren acción.
   * Lista corta clickeable desde el dashboard. */
  conversaciones_atencion: Array<{
    conversacion_id: string;
    nombre: string;
    telefono: string;
    ultimo_mensaje_en: string | null;
    estado_lead: EstadoLead;
    lead_score: number;
  }>;

  // ===== Citas =====
  citas_total: number;
  citas_proximas_7d: number;
  citas_hoy: number;
  citas_realizadas: number;
  citas_canceladas: number;
  citas_no_asistio: number;
  /** Tasa de show-up: realizadas / (realizadas + no_asistio + canceladas). */
  tasa_asistencia_citas: number;
}

// ============================================================
// Cliente admin (singleton, lazy)
// ============================================================
let _admin: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_admin) _admin = crearClienteAdmin();
  return _admin;
}

// Helpers
function lanzar(error: unknown, contexto: string): never {
  // Los errores de Supabase/PostgREST vienen como objetos con
  // { message, code, details, hint }. String(obj) da "[object Object]"
  // que es inútil para debug. Construimos un mensaje completo.
  let msg: string;
  if (error instanceof Error) {
    msg = error.message;
  } else if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const partes: string[] = [];
    if (typeof e.message === "string") partes.push(e.message);
    if (typeof e.code === "string") partes.push(`code=${e.code}`);
    if (typeof e.details === "string") partes.push(`details=${e.details}`);
    if (typeof e.hint === "string") partes.push(`hint=${e.hint}`);
    msg = partes.length > 0 ? partes.join(" | ") : JSON.stringify(error);
  } else {
    msg = String(error);
  }
  throw new Error(`[baseDatos:${contexto}] ${msg}`);
}

// ============================================================
// USUARIOS
// ============================================================

export interface UsuarioApp {
  id: string;
  email: string;
  nombre: string | null;
  plan: string; // free | pro | business — normalizar con planes.ts
  rol: string; // owner | admin | etc.
  creado_en: string;
  actualizada_en: string;
}

export async function obtenerUsuarioApp(id: string): Promise<UsuarioApp | null> {
  const { data, error } = await db()
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerUsuarioApp");
  return (data as UsuarioApp) ?? null;
}

export async function actualizarNombreUsuario(
  id: string,
  nombre: string,
): Promise<UsuarioApp | null> {
  const limpio = nombre.trim().slice(0, 100);
  const { data, error } = await db()
    .from("usuarios")
    .update({ nombre: limpio || null })
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarNombreUsuario");
  return data as UsuarioApp;
}

/**
 * Cuenta cuántas cuentas WhatsApp NO archivadas tiene un usuario.
 * Usado para enforce de límites de plan.
 */
export async function contarCuentasDeUsuario(usuarioId: string): Promise<number> {
  const { count, error } = await db()
    .from("cuentas")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("esta_archivada", false);
  if (error) lanzar(error, "contarCuentasDeUsuario");
  return count ?? 0;
}

// ============================================================
// CUENTAS
// ============================================================

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
  // Sembrar etapas default
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
    wa_phone_number_id: string | null;
    wa_business_account_id: string | null;
    wa_access_token: string | null;
    wa_verify_token: string | null;
    wa_app_secret: string | null;
    wa_estado: "desconectado" | "verificando" | "conectado" | "error";
    wa_verificada_en: string | null;
    wa_ultimo_error: string | null;
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

// ============================================================
// CONVERSACIONES
// ============================================================

export async function obtenerOCrearConversacion(
  cuentaId: string,
  telefono: string,
  nombre?: string | null,
  jidWa?: string | null,
): Promise<Conversacion> {
  // Buscar existente
  const { data: existente, error: errBuscar } = await db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("telefono", telefono)
    .maybeSingle();
  if (errBuscar) lanzar(errBuscar, "obtenerOCrearConversacion.buscar");
  if (existente) {
    // Actualizar nombre/jid si vienen y eran null
    const cambios: Record<string, unknown> = {};
    if (nombre && !(existente as Conversacion).nombre) cambios.nombre = nombre;
    if (jidWa && (existente as Conversacion).jid_wa !== jidWa)
      cambios.jid_wa = jidWa;
    if (Object.keys(cambios).length > 0) {
      const { data: actualizada, error: errUpd } = await db()
        .from("conversaciones")
        .update(cambios)
        .eq("id", (existente as Conversacion).id)
        .select()
        .single();
      if (errUpd) lanzar(errUpd, "obtenerOCrearConversacion.update");
      return actualizada as Conversacion;
    }
    return existente as Conversacion;
  }
  // Crear nueva
  const { data: nueva, error: errCrear } = await db()
    .from("conversaciones")
    .insert({
      cuenta_id: cuentaId,
      telefono,
      nombre: nombre ?? null,
      jid_wa: jidWa ?? null,
    })
    .select()
    .single();
  if (errCrear) lanzar(errCrear, "obtenerOCrearConversacion.crear");
  return nueva as Conversacion;
}

export async function obtenerConversacionPorId(
  id: string,
): Promise<Conversacion | null> {
  const { data, error } = await db()
    .from("conversaciones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerConversacionPorId");
  return (data as Conversacion) ?? null;
}

export async function listarConversaciones(
  cuentaId: string,
): Promise<ConversacionConPreview[]> {
  // Conversaciones + último mensaje (preview) + etiquetas
  // Lo hacemos en pasos para no tirar de RPC compleja:
  const { data: convs, error: errC } = await db()
    .from("conversaciones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false });
  if (errC) lanzar(errC, "listarConversaciones");
  if (!convs || convs.length === 0) return [];

  const convIds = convs.map((c) => (c as Conversacion).id);

  // Map de cuándo el operador vio cada conv (para contar "nuevos").
  const ultimoVistoMap = new Map<string, number>();
  for (const cv of convs as Conversacion[]) {
    if (cv.ultimo_visto_operador_en) {
      ultimoVistoMap.set(cv.id, new Date(cv.ultimo_visto_operador_en).getTime());
    }
  }

  // Vistas previas + rol del último mensaje + contador "nuevos".
  // Limitamos a los últimos 5000 msgs para no traer la DB completa en
  // cuentas con mucho histórico — alcanza para que cada conv tenga sus
  // mensajes recientes.
  const previews = new Map<string, string>();
  const previewRol = new Map<string, RolMensaje>();
  const nuevos = new Map<string, number>();
  const { data: msgs } = await db()
    .from("mensajes")
    .select("conversacion_id, contenido, creado_en, rol, tipo")
    .in("conversacion_id", convIds)
    .order("creado_en", { ascending: false })
    .limit(5000);
  if (msgs) {
    type FilaMsg = {
      conversacion_id: string;
      contenido: string;
      creado_en: string;
      rol: RolMensaje;
      tipo: TipoMensaje;
    };
    for (const m of msgs as FilaMsg[]) {
      // Preview = primer mensaje no-sistema más reciente.
      if (!previews.has(m.conversacion_id)) {
        let preview = m.contenido;
        if (m.tipo === "imagen" && !preview?.trim()) preview = "📷 Imagen";
        else if (m.tipo === "audio" && !preview?.trim()) preview = "🎤 Audio";
        else if (m.tipo === "video" && !preview?.trim()) preview = "🎬 Video";
        else if (m.tipo === "documento" && !preview?.trim()) preview = "📎 Documento";
        previews.set(m.conversacion_id, preview ?? "");
        previewRol.set(m.conversacion_id, m.rol);
      }
      // mensajes_nuevos = mensajes del cliente posteriores al
      // ultimo_visto_operador_en (o TODOS si nunca abrió la conv).
      // Persisten aunque la IA responda — solo se resetean cuando
      // el operador hace click en la conversación.
      if (m.rol === "usuario") {
        const visto = ultimoVistoMap.get(m.conversacion_id);
        const tsMsg = new Date(m.creado_en).getTime();
        if (visto === undefined || tsMsg > visto) {
          nuevos.set(
            m.conversacion_id,
            (nuevos.get(m.conversacion_id) ?? 0) + 1,
          );
        }
      }
    }
  }

  // Etiquetas asignadas por conversación
  const etiquetasMap = new Map<string, EtiquetaResumen[]>();
  const { data: ce } = await db()
    .from("conversacion_etiquetas")
    .select("conversacion_id, etiquetas (id, nombre, color, orden)")
    .in("conversacion_id", convIds);
  if (ce) {
    // Supabase devuelve la relación como objeto único o array según la
    // multiplicidad detectada; tratamos ambos casos.
    type FilaCE = {
      conversacion_id: string;
      etiquetas:
        | { id: string; nombre: string; color: string; orden: number }
        | Array<{ id: string; nombre: string; color: string; orden: number }>
        | null;
    };
    for (const row of ce as unknown as FilaCE[]) {
      if (!row.etiquetas) continue;
      const lista = Array.isArray(row.etiquetas) ? row.etiquetas : [row.etiquetas];
      const arr = etiquetasMap.get(row.conversacion_id) ?? [];
      for (const et of lista) {
        arr.push({ id: et.id, nombre: et.nombre, color: et.color });
      }
      etiquetasMap.set(row.conversacion_id, arr);
    }
  }

  return (convs as Conversacion[]).map((c) => ({
    ...c,
    vista_previa_ultimo_mensaje: previews.get(c.id) ?? null,
    vista_previa_rol: previewRol.get(c.id) ?? null,
    mensajes_nuevos: nuevos.get(c.id) ?? 0,
    etiquetas: etiquetasMap.get(c.id) ?? [],
  }));
}

/** Marca la conversación como leída por el operador. Resetea el badge
 * de "mensajes nuevos" en la lista de chats. Se llama desde el panel
 * cuando el operador hace click en una conversación. */
export async function marcarConversacionComoLeida(
  conversacionId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ ultimo_visto_operador_en: new Date().toISOString() })
    .eq("id", conversacionId);
  if (error) lanzar(error, "marcarConversacionComoLeida");
}

export async function cambiarModo(
  conversacionId: string,
  modo: ModoConversacion,
): Promise<void> {
  const cambios: Record<string, unknown> = { modo };
  if (modo === "IA") cambios.necesita_humano = false;
  const { error } = await db()
    .from("conversaciones")
    .update(cambios)
    .eq("id", conversacionId);
  if (error) lanzar(error, "cambiarModo");
}

export async function marcarConversacionNecesitaHumano(
  conversacionId: string,
  razon: string,
): Promise<void> {
  const { error: errUpd } = await db()
    .from("conversaciones")
    .update({ necesita_humano: true, modo: "HUMANO" })
    .eq("id", conversacionId);
  if (errUpd) lanzar(errUpd, "marcarConversacionNecesitaHumano");

  const { data: conv } = await db()
    .from("conversaciones")
    .select("cuenta_id")
    .eq("id", conversacionId)
    .single();
  if (conv) {
    await insertarMensaje(
      (conv as { cuenta_id: string }).cuenta_id,
      conversacionId,
      "sistema",
      `[Handoff a humano] ${razon}`,
      { tipo: "sistema" },
    );
  }
}

export async function borrarConversacion(id: string): Promise<void> {
  // Cascada via FK ON DELETE CASCADE (mensajes, bandeja, etiquetas)
  const { error } = await db().from("conversaciones").delete().eq("id", id);
  if (error) lanzar(error, "borrarConversacion");
}

export async function cambiarEtapaConversacion(
  conversacionId: string,
  etapaId: string | null,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ etapa_id: etapaId })
    .eq("id", conversacionId);
  if (error) lanzar(error, "cambiarEtapaConversacion");
}

/**
 * Actualiza lead tracking de una conversación. Recibe parches parciales
 * — solo se aplican los campos provistos. Para `datos_capturados` hace
 * MERGE con lo existente (no reemplaza), de modo que cuando la IA solo
 * captura email no perdemos el nombre que ya estaba.
 *
 * Devuelve la conversación actualizada para que el caller pueda mostrar
 * un mensaje sistema con los cambios aplicados.
 */
export async function actualizarLead(
  conversacionId: string,
  cambios: {
    nombre?: string | null;
    lead_score?: number;
    estado_lead?: EstadoLead;
    paso_actual?: string;
    datos_capturados_merge?: Partial<DatosCapturados>;
  },
): Promise<Conversacion | null> {
  // Si hay merge de datos, lo hacemos en JS para evitar SQL complejo —
  // primero leo, mergeo, escribo.
  const upd: Record<string, unknown> = {};
  if (cambios.nombre !== undefined) upd.nombre = cambios.nombre;
  if (cambios.lead_score !== undefined) {
    upd.lead_score = Math.max(0, Math.min(100, Math.round(cambios.lead_score)));
  }
  if (cambios.estado_lead !== undefined) upd.estado_lead = cambios.estado_lead;
  if (cambios.paso_actual !== undefined) upd.paso_actual = cambios.paso_actual;

  if (cambios.datos_capturados_merge) {
    const actual = await obtenerConversacionPorId(conversacionId);
    if (!actual) return null;
    const merged: DatosCapturados = { ...actual.datos_capturados };
    for (const [k, v] of Object.entries(cambios.datos_capturados_merge)) {
      if (v === undefined) continue;
      if (k === "otros") {
        merged.otros = {
          ...(merged.otros ?? {}),
          ...((v as Record<string, string>) ?? {}),
        };
      } else if (v === null || v === "") {
        // null/string-vacío → no pisamos; ignoramos. La IA a veces
        // manda strings vacíos cuando no tiene info nueva.
        continue;
      } else {
        (merged as Record<string, unknown>)[k] = v;
      }
    }
    upd.datos_capturados = merged;
  }

  if (Object.keys(upd).length === 0) {
    return await obtenerConversacionPorId(conversacionId);
  }

  const { data, error } = await db()
    .from("conversaciones")
    .update(upd)
    .eq("id", conversacionId)
    .select()
    .single();
  if (error) lanzar(error, "actualizarLead");
  return data as Conversacion;
}

// ============================================================
// MENSAJES
// ============================================================

export async function insertarMensaje(
  cuentaId: string,
  conversacionId: string,
  rol: RolMensaje,
  contenido: string,
  opciones?: {
    tipo?: TipoMensaje;
    media_path?: string | null;
    wa_msg_id?: string | null;
    /** Si viene, se usa como creado_en (ISO string). Sirve para
     * mensajes históricos importados con su timestamp original. */
    creado_en?: string;
    /** Si true, no actualiza ultimo_mensaje_en (mensajes históricos). */
    es_historico?: boolean;
  },
): Promise<Mensaje | null> {
  const fila: Record<string, unknown> = {
    cuenta_id: cuentaId,
    conversacion_id: conversacionId,
    rol,
    tipo: opciones?.tipo ?? "texto",
    contenido,
    media_path: opciones?.media_path ?? null,
    wa_msg_id: opciones?.wa_msg_id ?? null,
  };
  if (opciones?.creado_en) fila.creado_en = opciones.creado_en;

  // Si trae wa_msg_id usamos upsert para idempotencia. Si no, insert plano.
  let res;
  if (opciones?.wa_msg_id) {
    res = await db()
      .from("mensajes")
      .upsert(fila, {
        onConflict: "cuenta_id,wa_msg_id",
        ignoreDuplicates: true,
      })
      .select()
      .maybeSingle();
  } else {
    res = await db().from("mensajes").insert(fila).select().single();
  }
  if (res.error) lanzar(res.error, "insertarMensaje");
  // Si fue duplicado (upsert con ignoreDuplicates) data viene null — es OK.
  if (!res.data) return null;

  // Solo actualizamos ultimo_mensaje_en para mensajes en tiempo real,
  // no para los históricos (que llegan en cualquier orden).
  if (!opciones?.es_historico) {
    await db()
      .from("conversaciones")
      .update({ ultimo_mensaje_en: new Date().toISOString() })
      .eq("id", conversacionId);
  }

  // Webhook saliente "mensaje_enviado" — solo para mensajes que SALIERON
  // por WhatsApp (asistente/humano), no para entrantes ni sistema ni
  // históricos. Import dinámico para no acoplar baseDatos a webhooks.
  if (!opciones?.es_historico && (rol === "asistente" || rol === "humano")) {
    void (async () => {
      try {
        const { dispararWebhook } = await import("./webhooks");
        const m = res.data as Mensaje;
        dispararWebhook(cuentaId, "mensaje_enviado", {
          mensaje_id: m.id,
          conversacion_id: conversacionId,
          rol,
          tipo: m.tipo,
          contenido: m.contenido,
          media_path: m.media_path,
          wa_msg_id: m.wa_msg_id,
        });
      } catch {
        /* ignorar */
      }
    })();
  }

  return res.data as Mensaje;
}

/** Devuelve el mensaje más viejo de la conversación (con wa_msg_id),
 * útil para pedir más historial via fetchMessageHistory. */
export async function obtenerMensajeMasViejoConWaId(
  conversacionId: string,
): Promise<Mensaje | null> {
  const { data, error } = await db()
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .not("wa_msg_id", "is", null)
    .order("creado_en", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) lanzar(error, "obtenerMensajeMasViejoConWaId");
  return (data as Mensaje) ?? null;
}

/** Cuenta cuántos mensajes tiene una conversación.
 * Usado para detectar conversaciones recién creadas (fetch on-demand). */
export async function contarMensajesDeConversacion(
  conversacionId: string,
): Promise<number> {
  const { count, error } = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("conversacion_id", conversacionId);
  if (error) lanzar(error, "contarMensajesDeConversacion");
  return count ?? 0;
}

export async function obtenerMensajes(
  conversacionId: string,
  limite = 200,
): Promise<Mensaje[]> {
  const { data, error } = await db()
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: true })
    .limit(limite);
  if (error) lanzar(error, "obtenerMensajes");
  return (data ?? []) as Mensaje[];
}

export async function obtenerHistorialReciente(
  conversacionId: string,
  limite = 20,
): Promise<Mensaje[]> {
  const { data, error } = await db()
    .from("mensajes")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "obtenerHistorialReciente");
  return ((data ?? []) as Mensaje[]).reverse();
}

// ============================================================
// BANDEJA DE SALIDA
// ============================================================

export async function encolarBandejaSalida(
  cuentaId: string,
  conversacionId: string,
  telefono: string,
  contenido: string,
  opciones?: { tipo?: TipoMensaje; media_path?: string | null },
): Promise<string> {
  const { data, error } = await db()
    .from("bandeja_salida")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      telefono,
      tipo: opciones?.tipo ?? "texto",
      contenido,
      media_path: opciones?.media_path ?? null,
    })
    .select("id")
    .single();
  if (error) lanzar(error, "encolarBandejaSalida");
  return (data as { id: string }).id;
}

export async function obtenerPendientesBandejaDeCuenta(
  cuentaId: string,
  limite = 20,
): Promise<FilaBandejaSalida[]> {
  const { data, error } = await db()
    .from("bandeja_salida")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("enviado", false)
    .order("creado_en", { ascending: true })
    .limit(limite);
  if (error) lanzar(error, "obtenerPendientesBandejaDeCuenta");
  return (data ?? []) as FilaBandejaSalida[];
}

export async function marcarBandejaEnviado(id: string): Promise<void> {
  const { error } = await db()
    .from("bandeja_salida")
    .update({ enviado: true })
    .eq("id", id);
  if (error) lanzar(error, "marcarBandejaEnviado");
}

// ============================================================
// CONOCIMIENTO
// ============================================================

export async function listarConocimientoDeCuenta(
  cuentaId: string,
): Promise<EntradaConocimiento[]> {
  const { data, error } = await db()
    .from("conocimiento")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarConocimientoDeCuenta");
  return (data ?? []) as EntradaConocimiento[];
}

export async function crearConocimiento(
  cuentaId: string,
  titulo: string,
  contenido: string,
  opciones?: { categoria?: string; esta_activo?: boolean },
): Promise<EntradaConocimiento> {
  // Próximo orden
  const { data: max } = await db()
    .from("conocimiento")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("conocimiento")
    .insert({
      cuenta_id: cuentaId,
      titulo,
      contenido,
      orden,
      categoria: opciones?.categoria?.trim() || "general",
      esta_activo: opciones?.esta_activo ?? true,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearConocimiento");
  return data as EntradaConocimiento;
}

export async function actualizarConocimiento(
  id: string,
  cambios: Partial<{
    titulo: string;
    contenido: string;
    orden: number;
    categoria: string;
    esta_activo: boolean;
  }>,
): Promise<EntradaConocimiento | null> {
  const { data, error } = await db()
    .from("conocimiento")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarConocimiento");
  return data as EntradaConocimiento;
}

export async function borrarConocimiento(id: string): Promise<void> {
  const { error } = await db().from("conocimiento").delete().eq("id", id);
  if (error) lanzar(error, "borrarConocimiento");
}

// ============================================================
// RESPUESTAS RÁPIDAS
// ============================================================

export async function listarRespuestasRapidas(
  cuentaId: string,
): Promise<RespuestaRapida[]> {
  const { data, error } = await db()
    .from("respuestas_rapidas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarRespuestasRapidas");
  return (data ?? []) as RespuestaRapida[];
}

export async function crearRespuestaRapida(
  cuentaId: string,
  atajo: string,
  texto: string,
): Promise<RespuestaRapida> {
  const { data: max } = await db()
    .from("respuestas_rapidas")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("respuestas_rapidas")
    .insert({ cuenta_id: cuentaId, atajo, texto, orden })
    .select()
    .single();
  if (error) lanzar(error, "crearRespuestaRapida");
  return data as RespuestaRapida;
}

export async function actualizarRespuestaRapida(
  id: string,
  cambios: Partial<{ atajo: string; texto: string; orden: number }>,
): Promise<RespuestaRapida | null> {
  const { data, error } = await db()
    .from("respuestas_rapidas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarRespuestaRapida");
  return data as RespuestaRapida;
}

export async function borrarRespuestaRapida(id: string): Promise<void> {
  const { error } = await db()
    .from("respuestas_rapidas")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarRespuestaRapida");
}

// ============================================================
// ETIQUETAS
// ============================================================

export async function listarEtiquetas(cuentaId: string): Promise<Etiqueta[]> {
  const { data, error } = await db()
    .from("etiquetas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarEtiquetas");
  return (data ?? []) as Etiqueta[];
}

export async function listarEtiquetasConCount(
  cuentaId: string,
): Promise<EtiquetaConCount[]> {
  const etiquetas = await listarEtiquetas(cuentaId);
  if (etiquetas.length === 0) return [];
  const { data: counts } = await db()
    .from("conversacion_etiquetas")
    .select("etiqueta_id")
    .in(
      "etiqueta_id",
      etiquetas.map((e) => e.id),
    );
  const map = new Map<string, number>();
  for (const row of (counts ?? []) as Array<{ etiqueta_id: string }>) {
    map.set(row.etiqueta_id, (map.get(row.etiqueta_id) ?? 0) + 1);
  }
  return etiquetas.map((e) => ({
    ...e,
    conversaciones_count: map.get(e.id) ?? 0,
  }));
}

export async function crearEtiqueta(
  cuentaId: string,
  nombre: string,
  color = "zinc",
  descripcion: string | null = null,
): Promise<Etiqueta> {
  const { data, error } = await db()
    .from("etiquetas")
    .insert({ cuenta_id: cuentaId, nombre, color, descripcion })
    .select()
    .single();
  if (error) lanzar(error, "crearEtiqueta");
  return data as Etiqueta;
}

export async function actualizarEtiqueta(
  id: string,
  cambios: Partial<{
    nombre: string;
    color: string;
    descripcion: string | null;
    orden: number;
  }>,
): Promise<Etiqueta | null> {
  const { data, error } = await db()
    .from("etiquetas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarEtiqueta");
  return data as Etiqueta;
}

export async function borrarEtiqueta(id: string): Promise<void> {
  const { error } = await db().from("etiquetas").delete().eq("id", id);
  if (error) lanzar(error, "borrarEtiqueta");
}

export async function asignarEtiqueta(
  conversacionId: string,
  etiquetaId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversacion_etiquetas")
    .upsert(
      { conversacion_id: conversacionId, etiqueta_id: etiquetaId },
      { onConflict: "conversacion_id,etiqueta_id" },
    );
  if (error) lanzar(error, "asignarEtiqueta");
}

export async function desasignarEtiqueta(
  conversacionId: string,
  etiquetaId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversacion_etiquetas")
    .delete()
    .eq("conversacion_id", conversacionId)
    .eq("etiqueta_id", etiquetaId);
  if (error) lanzar(error, "desasignarEtiqueta");
}

export async function listarEtiquetasDeConversacion(
  conversacionId: string,
): Promise<Etiqueta[]> {
  const { data, error } = await db()
    .from("conversacion_etiquetas")
    .select("etiquetas (*)")
    .eq("conversacion_id", conversacionId);
  if (error) lanzar(error, "listarEtiquetasDeConversacion");
  const filas = (data ?? []) as unknown as Array<{
    etiquetas: Etiqueta | Etiqueta[] | null;
  }>;
  const out: Etiqueta[] = [];
  for (const f of filas) {
    if (!f.etiquetas) continue;
    if (Array.isArray(f.etiquetas)) out.push(...f.etiquetas);
    else out.push(f.etiquetas);
  }
  return out;
}

// ============================================================
// BIBLIOTECA DE MEDIOS
// ============================================================

export async function listarBiblioteca(
  cuentaId: string,
): Promise<MedioBiblioteca[]> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarBiblioteca");
  return (data ?? []) as MedioBiblioteca[];
}

export async function obtenerMedioBiblioteca(
  id: string,
): Promise<MedioBiblioteca | null> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerMedioBiblioteca");
  return (data as MedioBiblioteca) ?? null;
}

export async function obtenerMedioPorIdentificador(
  cuentaId: string,
  identificador: string,
): Promise<MedioBiblioteca | null> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("identificador", identificador)
    .maybeSingle();
  if (error) lanzar(error, "obtenerMedioPorIdentificador");
  return (data as MedioBiblioteca) ?? null;
}

export async function crearMedioBiblioteca(
  cuentaId: string,
  identificador: string,
  tipo: TipoMediaBiblioteca,
  rutaArchivo: string,
  descripcion: string,
): Promise<MedioBiblioteca> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .insert({
      cuenta_id: cuentaId,
      identificador,
      tipo,
      ruta_archivo: rutaArchivo,
      descripcion,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearMedioBiblioteca");
  return data as MedioBiblioteca;
}

export async function actualizarDescripcionMedio(
  id: string,
  descripcion: string,
): Promise<MedioBiblioteca | null> {
  const { data, error } = await db()
    .from("biblioteca_medios")
    .update({ descripcion })
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarDescripcionMedio");
  return data as MedioBiblioteca;
}

export async function borrarMedioBiblioteca(id: string): Promise<void> {
  const { error } = await db()
    .from("biblioteca_medios")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarMedioBiblioteca");
}

// ============================================================
// ETAPAS PIPELINE
// ============================================================

const ETAPAS_DEFAULT: Array<{ nombre: string; color: string }> = [
  { nombre: "Nuevo", color: "zinc" },
  { nombre: "Contactado", color: "azul" },
  { nombre: "Interesado", color: "amarillo" },
  { nombre: "Negociando", color: "ambar" },
  { nombre: "Cerrado", color: "esmeralda" },
  { nombre: "Perdido", color: "rojo" },
];

export async function listarEtapas(cuentaId: string): Promise<EtapaPipeline[]> {
  const { data, error } = await db()
    .from("etapas_pipeline")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarEtapas");
  return (data ?? []) as EtapaPipeline[];
}

export async function obtenerEtapa(id: string): Promise<EtapaPipeline | null> {
  const { data, error } = await db()
    .from("etapas_pipeline")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerEtapa");
  return (data as EtapaPipeline) ?? null;
}

export async function crearEtapa(
  cuentaId: string,
  nombre: string,
  color: string,
): Promise<EtapaPipeline> {
  const { data: max } = await db()
    .from("etapas_pipeline")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("etapas_pipeline")
    .insert({ cuenta_id: cuentaId, nombre, color, orden })
    .select()
    .single();
  if (error) lanzar(error, "crearEtapa");
  return data as EtapaPipeline;
}

export async function actualizarEtapa(
  id: string,
  cambios: Partial<{ nombre: string; color: string; orden: number }>,
): Promise<EtapaPipeline | null> {
  const { data, error } = await db()
    .from("etapas_pipeline")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarEtapa");
  return data as EtapaPipeline;
}

export async function reordenarEtapas(
  cuentaId: string,
  ordenIds: string[],
): Promise<void> {
  // No hay batch update fácil, hacemos un loop
  for (let i = 0; i < ordenIds.length; i++) {
    const { error } = await db()
      .from("etapas_pipeline")
      .update({ orden: i + 1 })
      .eq("id", ordenIds[i])
      .eq("cuenta_id", cuentaId);
    if (error) lanzar(error, "reordenarEtapas");
  }
}

export async function borrarEtapa(id: string): Promise<void> {
  // FK ON DELETE SET NULL ya se encarga de las conversaciones
  const { error } = await db().from("etapas_pipeline").delete().eq("id", id);
  if (error) lanzar(error, "borrarEtapa");
}

export async function sembrarEtapasSiVacias(cuentaId: string): Promise<void> {
  const existentes = await listarEtapas(cuentaId);
  if (existentes.length > 0) return;
  const filas = ETAPAS_DEFAULT.map((e, idx) => ({
    cuenta_id: cuentaId,
    nombre: e.nombre,
    color: e.color,
    orden: idx + 1,
  }));
  const { error } = await db().from("etapas_pipeline").insert(filas);
  if (error) lanzar(error, "sembrarEtapasSiVacias");
}

// ============================================================
// CONTACTOS EMAIL
// ============================================================

const REGEX_EMAIL = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;

export function extraerEmailsDelTexto(texto: string): string[] {
  if (!texto) return [];
  const matches = texto.match(REGEX_EMAIL) ?? [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

export function clasificarValidezEmail(email: string): ValidezEmail {
  const e = email.trim().toLowerCase();
  if (!e || !e.includes("@") || !e.includes(".")) return "invalido";
  const [user, dominio] = e.split("@");
  if (!user || !dominio) return "invalido";
  if (user.length < 2) return "sospechoso";
  if (user.length > 64) return "invalido";
  if (!dominio.includes(".")) return "invalido";
  if (dominio.length < 4) return "sospechoso";
  if (/(.)\1{4,}/.test(user)) return "sospechoso";
  const tld = dominio.split(".").pop() ?? "";
  if (tld.length < 2) return "invalido";
  const dominiosComunes = [
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "yahoo.com",
    "icloud.com",
    "live.com",
  ];
  for (const d of dominiosComunes) {
    if (dominio === d) return "valido";
    if (dominio.length === d.length) {
      let diffs = 0;
      for (let i = 0; i < d.length; i++) if (dominio[i] !== d[i]) diffs++;
      if (diffs > 0 && diffs <= 2) return "sospechoso";
    }
  }
  return "valido";
}

export async function guardarContactosEmail(
  cuentaId: string,
  conversacionId: string,
  emails: string[],
): Promise<{ nuevos: number; sospechosos: string[] }> {
  if (emails.length === 0) return { nuevos: 0, sospechosos: [] };
  const sospechosos: string[] = [];
  const aInsertar: Array<{
    cuenta_id: string;
    conversacion_id: string;
    email: string;
    validez: ValidezEmail;
  }> = [];
  for (const email of emails) {
    const validez = clasificarValidezEmail(email);
    if (validez === "invalido") continue;
    if (validez === "sospechoso") sospechosos.push(email);
    aInsertar.push({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      email,
      validez,
    });
  }
  if (aInsertar.length === 0) return { nuevos: 0, sospechosos };
  // Upsert con ignore-on-conflict via onConflict
  const { data, error } = await db()
    .from("contactos_email")
    .upsert(aInsertar, {
      onConflict: "cuenta_id,email",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) lanzar(error, "guardarContactosEmail");
  return { nuevos: (data ?? []).length, sospechosos };
}

export async function listarContactosEmail(
  cuentaId: string,
): Promise<ContactoEmailConTelefono[]> {
  const { data, error } = await db()
    .from("contactos_email")
    .select(
      "*, conversaciones (nombre, telefono)",
    )
    .eq("cuenta_id", cuentaId)
    .order("capturado_en", { ascending: false });
  if (error) lanzar(error, "listarContactosEmail");
  return ((data ?? []) as Array<
    ContactoEmail & { conversaciones: { nombre: string | null; telefono: string } | null }
  >).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones?.nombre ?? null,
    telefono: r.conversaciones?.telefono ?? null,
  }));
}

export async function borrarContactoEmail(id: string): Promise<void> {
  const { error } = await db().from("contactos_email").delete().eq("id", id);
  if (error) lanzar(error, "borrarContactoEmail");
}

export async function contarContactosEmail(cuentaId: string): Promise<number> {
  const { count, error } = await db()
    .from("contactos_email")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "contarContactosEmail");
  return count ?? 0;
}

// ============================================================
// CONTACTOS TELÉFONO
// ============================================================

const REGEX_TELEFONO = /\+?\d[\d\s().-]{7,18}\d/g;

export function extraerTelefonosDelTexto(texto: string): string[] {
  if (!texto) return [];
  const matches = texto.match(REGEX_TELEFONO) ?? [];
  const limpios: string[] = [];
  for (const m of matches) {
    const digitos = m.replace(/[^\d]/g, "");
    if (digitos.length >= 8 && digitos.length <= 15) limpios.push(digitos);
  }
  return Array.from(new Set(limpios));
}

export async function guardarContactosTelefono(
  cuentaId: string,
  conversacionId: string,
  telefonos: string[],
  telefonoPropio?: string | null,
): Promise<number> {
  if (telefonos.length === 0) return 0;
  const propio = telefonoPropio?.replace(/[^\d]/g, "") ?? "";
  const aInsertar: Array<{
    cuenta_id: string;
    conversacion_id: string;
    telefono: string;
  }> = [];
  for (const tel of telefonos) {
    if (
      propio &&
      (tel === propio ||
        (propio.length > tel.length && propio.endsWith(tel)) ||
        (tel.length > propio.length && tel.endsWith(propio)))
    ) {
      continue;
    }
    aInsertar.push({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      telefono: tel,
    });
  }
  if (aInsertar.length === 0) return 0;
  const { data, error } = await db()
    .from("contactos_telefono")
    .upsert(aInsertar, {
      onConflict: "cuenta_id,telefono",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) lanzar(error, "guardarContactosTelefono");
  return (data ?? []).length;
}

export async function listarContactosTelefono(
  cuentaId: string,
): Promise<ContactoTelefonoConContexto[]> {
  const { data, error } = await db()
    .from("contactos_telefono")
    .select("*, conversaciones (nombre, telefono)")
    .eq("cuenta_id", cuentaId)
    .order("capturado_en", { ascending: false });
  if (error) lanzar(error, "listarContactosTelefono");
  return ((data ?? []) as Array<
    ContactoTelefono & {
      conversaciones: { nombre: string | null; telefono: string } | null;
    }
  >).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones?.nombre ?? null,
    telefono_conv: r.conversaciones?.telefono ?? null,
  }));
}

export async function borrarContactoTelefono(id: string): Promise<void> {
  const { error } = await db()
    .from("contactos_telefono")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarContactoTelefono");
}

export async function contarContactosTelefono(
  cuentaId: string,
): Promise<number> {
  const { count, error } = await db()
    .from("contactos_telefono")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "contarContactosTelefono");
  return count ?? 0;
}

// ============================================================
// PRODUCTOS
// ============================================================

export async function listarProductos(cuentaId: string): Promise<Producto[]> {
  const { data, error } = await db()
    .from("productos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("esta_activo", { ascending: false })
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarProductos");
  return (data ?? []) as Producto[];
}

export async function listarProductosActivos(
  cuentaId: string,
): Promise<Producto[]> {
  const { data, error } = await db()
    .from("productos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("esta_activo", true)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarProductosActivos");
  return (data ?? []) as Producto[];
}

export async function obtenerProducto(id: string): Promise<Producto | null> {
  const { data, error } = await db()
    .from("productos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerProducto");
  return (data as Producto) ?? null;
}

export async function crearProducto(
  cuentaId: string,
  datos: {
    nombre: string;
    descripcion?: string;
    precio?: number | null;
    moneda?: string;
    costo?: number | null;
    stock?: number | null;
    sku?: string | null;
    categoria?: string | null;
    imagen_path?: string | null;
  },
): Promise<Producto> {
  const { data: max } = await db()
    .from("productos")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("productos")
    .insert({
      cuenta_id: cuentaId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? "",
      precio: datos.precio ?? null,
      moneda: datos.moneda ?? "COP",
      costo: datos.costo ?? null,
      stock: datos.stock ?? null,
      sku: datos.sku ?? null,
      categoria: datos.categoria ?? null,
      imagen_path: datos.imagen_path ?? null,
      orden,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearProducto");
  return data as Producto;
}

export async function actualizarProducto(
  id: string,
  datos: Partial<{
    nombre: string;
    descripcion: string;
    precio: number | null;
    moneda: string;
    costo: number | null;
    stock: number | null;
    sku: string | null;
    categoria: string | null;
    imagen_path: string | null;
    video_path: string | null;
    esta_activo: boolean;
    orden: number;
  }>,
): Promise<Producto | null> {
  const cambios: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos)) {
    if (v !== undefined) cambios[k] = v;
  }
  if (Object.keys(cambios).length === 0) return obtenerProducto(id);
  const { data, error } = await db()
    .from("productos")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarProducto");
  return data as Producto;
}

export async function borrarProducto(id: string): Promise<void> {
  const { error } = await db().from("productos").delete().eq("id", id);
  if (error) lanzar(error, "borrarProducto");
}

// ============================================================
// INTERÉS EN PRODUCTOS
// ============================================================

export async function registrarInteresEnProducto(
  conversacionId: string,
  productoId: string,
  cuentaId: string,
): Promise<void> {
  const ahoraIso = new Date().toISOString();
  // Upsert con incremento manual de veces
  const { data: existente } = await db()
    .from("conversacion_productos_interes")
    .select("veces")
    .eq("conversacion_id", conversacionId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (existente) {
    const { error } = await db()
      .from("conversacion_productos_interes")
      .update({
        veces: (existente as { veces: number }).veces + 1,
        ultimo_interes_en: ahoraIso,
      })
      .eq("conversacion_id", conversacionId)
      .eq("producto_id", productoId);
    if (error) lanzar(error, "registrarInteresEnProducto.update");
  } else {
    const { error } = await db()
      .from("conversacion_productos_interes")
      .insert({
        conversacion_id: conversacionId,
        producto_id: productoId,
        cuenta_id: cuentaId,
        ultimo_interes_en: ahoraIso,
        veces: 1,
      });
    if (error) lanzar(error, "registrarInteresEnProducto.insert");
  }
}

export async function listarInteresDeConversacion(
  conversacionId: string,
): Promise<InteresConProducto[]> {
  const { data, error } = await db()
    .from("conversacion_productos_interes")
    .select("*, productos (nombre, precio, moneda, imagen_path, stock)")
    .eq("conversacion_id", conversacionId)
    .order("ultimo_interes_en", { ascending: false });
  if (error) lanzar(error, "listarInteresDeConversacion");
  return ((data ?? []) as Array<
    InteresProducto & {
      productos: {
        nombre: string;
        precio: number | null;
        moneda: string;
        imagen_path: string | null;
        stock: number | null;
      };
    }
  >).map((r) => ({
    ...r,
    nombre: r.productos.nombre,
    precio: r.productos.precio,
    moneda: r.productos.moneda,
    imagen_path: r.productos.imagen_path,
    stock: r.productos.stock,
  }));
}

export async function listarInteresadosEnProducto(
  productoId: string,
): Promise<InteresadoEnProducto[]> {
  const { data, error } = await db()
    .from("conversacion_productos_interes")
    .select(
      "*, conversaciones (nombre, telefono, modo, necesita_humano)",
    )
    .eq("producto_id", productoId)
    .order("ultimo_interes_en", { ascending: false });
  if (error) lanzar(error, "listarInteresadosEnProducto");
  return ((data ?? []) as Array<
    InteresProducto & {
      conversaciones: {
        nombre: string | null;
        telefono: string;
        modo: ModoConversacion;
        necesita_humano: boolean;
      };
    }
  >).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones.nombre,
    telefono: r.conversaciones.telefono,
    modo: r.conversaciones.modo,
    necesita_humano: r.conversaciones.necesita_humano,
  }));
}

export async function listarTopProductos(
  cuentaId: string,
  limite = 10,
): Promise<ProductoTop[]> {
  const productos = await listarProductos(cuentaId);
  if (productos.length === 0) return [];
  const { data: intereses } = await db()
    .from("conversacion_productos_interes")
    .select("producto_id, conversacion_id, veces")
    .eq("cuenta_id", cuentaId);
  const stats = new Map<
    string,
    { conversaciones: Set<string>; menciones: number }
  >();
  for (const row of (intereses ?? []) as Array<{
    producto_id: string;
    conversacion_id: string;
    veces: number;
  }>) {
    const s = stats.get(row.producto_id) ?? {
      conversaciones: new Set<string>(),
      menciones: 0,
    };
    s.conversaciones.add(row.conversacion_id);
    s.menciones += row.veces;
    stats.set(row.producto_id, s);
  }
  return productos
    .map((p) => {
      const s = stats.get(p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        precio: p.precio,
        moneda: p.moneda,
        stock: p.stock,
        conversaciones_interesadas: s?.conversaciones.size ?? 0,
        total_menciones: s?.menciones ?? 0,
      };
    })
    .sort((a, b) => b.conversaciones_interesadas - a.conversaciones_interesadas)
    .slice(0, limite);
}

// ============================================================
// INVERSIONES
// ============================================================

export async function listarInversiones(
  cuentaId: string,
  limite = 200,
): Promise<Inversion[]> {
  const { data, error } = await db()
    .from("inversiones")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarInversiones");
  return (data ?? []) as Inversion[];
}

export async function obtenerInversion(id: string): Promise<Inversion | null> {
  const { data, error } = await db()
    .from("inversiones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerInversion");
  return (data as Inversion) ?? null;
}

export async function crearInversion(
  cuentaId: string,
  datos: {
    concepto: string;
    monto: number;
    moneda?: string;
    categoria?: string | null;
    fecha?: string; // ISO
    notas?: string | null;
  },
): Promise<Inversion> {
  const { data, error } = await db()
    .from("inversiones")
    .insert({
      cuenta_id: cuentaId,
      concepto: datos.concepto,
      monto: datos.monto,
      moneda: datos.moneda ?? "COP",
      categoria: datos.categoria ?? null,
      fecha: datos.fecha ?? new Date().toISOString(),
      notas: datos.notas ?? null,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearInversion");
  return data as Inversion;
}

export async function actualizarInversion(
  id: string,
  cambios: Partial<{
    concepto: string;
    monto: number;
    moneda: string;
    categoria: string | null;
    fecha: string;
    notas: string | null;
  }>,
): Promise<Inversion | null> {
  const { data, error } = await db()
    .from("inversiones")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarInversion");
  return data as Inversion;
}

export async function borrarInversion(id: string): Promise<void> {
  const { error } = await db().from("inversiones").delete().eq("id", id);
  if (error) lanzar(error, "borrarInversion");
}

export async function obtenerResumenInversiones(
  cuentaId: string,
): Promise<ResumenInversiones> {
  const { data, error } = await db()
    .from("inversiones")
    .select("monto, moneda, categoria")
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "obtenerResumenInversiones");
  const por_moneda_map = new Map<string, { total: number; n: number }>();
  const por_cat_map = new Map<string, { total: number; n: number }>();
  for (const row of (data ?? []) as Array<{
    monto: number;
    moneda: string;
    categoria: string | null;
  }>) {
    const monedaKey = row.moneda;
    const m = por_moneda_map.get(monedaKey) ?? { total: 0, n: 0 };
    m.total += Number(row.monto);
    m.n += 1;
    por_moneda_map.set(monedaKey, m);

    const cat = row.categoria || "Sin categoría";
    const catKey = `${cat}|${row.moneda}`;
    const c = por_cat_map.get(catKey) ?? { total: 0, n: 0 };
    c.total += Number(row.monto);
    c.n += 1;
    por_cat_map.set(catKey, c);
  }
  return {
    por_moneda: Array.from(por_moneda_map.entries()).map(([moneda, v]) => ({
      moneda,
      total: v.total,
      n: v.n,
    })),
    por_categoria: Array.from(por_cat_map.entries())
      .map(([k, v]) => {
        const [categoria, moneda] = k.split("|");
        return { categoria, moneda, total: v.total, n: v.n };
      })
      .sort((a, b) => b.total - a.total),
  };
}

// ============================================================
// SEGUIMIENTOS PROGRAMADOS
// ============================================================

export async function crearSeguimiento(
  cuentaId: string,
  conversacionId: string,
  contenido: string,
  programadoPara: string, // ISO
  origen: "humano" | "ia" = "humano",
): Promise<SeguimientoProgramado> {
  const { data, error } = await db()
    .from("seguimientos_programados")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      contenido,
      programado_para: programadoPara,
      origen,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearSeguimiento");
  return data as SeguimientoProgramado;
}

export async function obtenerSeguimiento(
  id: string,
): Promise<SeguimientoProgramado | null> {
  const { data, error } = await db()
    .from("seguimientos_programados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerSeguimiento");
  return (data as SeguimientoProgramado) ?? null;
}

export async function listarSeguimientosPendientesDue(
  ahoraIso: string = new Date().toISOString(),
): Promise<SeguimientoProgramado[]> {
  const { data, error } = await db()
    .from("seguimientos_programados")
    .select("*")
    .eq("estado", "pendiente")
    .lte("programado_para", ahoraIso)
    .order("programado_para", { ascending: true });
  if (error) lanzar(error, "listarSeguimientosPendientesDue");
  return (data ?? []) as SeguimientoProgramado[];
}

export async function listarSeguimientosDeCuenta(
  cuentaId: string,
): Promise<SeguimientoConContacto[]> {
  const { data, error } = await db()
    .from("seguimientos_programados")
    .select("*, conversaciones (nombre, telefono)")
    .eq("cuenta_id", cuentaId)
    .order("programado_para", { ascending: true });
  if (error) lanzar(error, "listarSeguimientosDeCuenta");
  return ((data ?? []) as Array<
    SeguimientoProgramado & {
      conversaciones: { nombre: string | null; telefono: string } | null;
    }
  >).map((r) => ({
    ...r,
    nombre_contacto: r.conversaciones?.nombre ?? null,
    telefono: r.conversaciones?.telefono ?? null,
  }));
}

export async function marcarSeguimientoEnviado(id: string): Promise<void> {
  const { error } = await db()
    .from("seguimientos_programados")
    .update({ estado: "enviado", enviado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) lanzar(error, "marcarSeguimientoEnviado");
}

export async function cancelarSeguimiento(
  id: string,
  razon: string,
): Promise<void> {
  const { error } = await db()
    .from("seguimientos_programados")
    .update({ estado: "cancelado", razon_cancelacion: razon })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (error) lanzar(error, "cancelarSeguimiento");
}

export async function marcarSeguimientoFallido(
  id: string,
  razon: string,
): Promise<void> {
  const { error } = await db()
    .from("seguimientos_programados")
    .update({ estado: "fallido", razon_cancelacion: razon })
    .eq("id", id);
  if (error) lanzar(error, "marcarSeguimientoFallido");
}

export async function contarMensajesUsuarioPosteriores(
  conversacionId: string,
  desdeIso: string,
): Promise<number> {
  const { count, error } = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("conversacion_id", conversacionId)
    .eq("rol", "usuario")
    .gt("creado_en", desdeIso);
  if (error) lanzar(error, "contarMensajesUsuarioPosteriores");
  return count ?? 0;
}

export async function contarMensajesEnviadosHoyCuenta(
  cuentaId: string,
): Promise<number> {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const { count, error } = await db()
    .from("mensajes")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId)
    .in("rol", ["asistente", "humano"])
    .gte("creado_en", inicioHoy.toISOString());
  if (error) lanzar(error, "contarMensajesEnviadosHoyCuenta");
  return count ?? 0;
}

// ============================================================
// CITAS / AGENDA
// ============================================================

export async function crearCita(
  cuentaId: string,
  datos: {
    conversacion_id?: string | null;
    cliente_nombre: string;
    cliente_telefono?: string | null;
    fecha_hora: string; // ISO
    duracion_min?: number;
    tipo?: string | null;
    notas?: string | null;
  },
): Promise<Cita> {
  const { data, error } = await db()
    .from("citas")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: datos.conversacion_id ?? null,
      cliente_nombre: datos.cliente_nombre,
      cliente_telefono: datos.cliente_telefono ?? null,
      fecha_hora: datos.fecha_hora,
      duracion_min: datos.duracion_min ?? 30,
      tipo: datos.tipo ?? null,
      notas: datos.notas ?? null,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearCita");
  return data as Cita;
}

export async function obtenerCita(id: string): Promise<Cita | null> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCita");
  return (data as Cita) ?? null;
}

export async function listarCitasDeCuenta(cuentaId: string): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("fecha_hora", { ascending: true });
  if (error) lanzar(error, "listarCitasDeCuenta");
  return (data ?? []) as Cita[];
}

export async function listarCitasFuturasDeCuenta(
  cuentaId: string,
  limite = 50,
): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .gte("fecha_hora", new Date().toISOString())
    .in("estado", ["agendada", "confirmada"])
    .order("fecha_hora", { ascending: true })
    .limit(limite);
  if (error) lanzar(error, "listarCitasFuturasDeCuenta");
  return (data ?? []) as Cita[];
}

/** Citas activas (agendada/confirmada) de UNA conversación, futuras.
 * Se usa para inyectar al prompt de la IA: "estas son las citas que
 * tiene este cliente, podés referirte a ellas por id si las quiere
 * cancelar o reprogramar". */
export async function listarCitasActivasDeConversacion(
  conversacionId: string,
): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .in("estado", ["agendada", "confirmada"])
    .gte("fecha_hora", new Date().toISOString())
    .order("fecha_hora", { ascending: true });
  if (error) lanzar(error, "listarCitasActivasDeConversacion");
  return (data ?? []) as Cita[];
}

export async function listarCitasParaRecordar(
  desdeIso: string,
  hastaIso: string,
): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .in("estado", ["agendada", "confirmada"])
    .eq("recordatorio_enviado", false)
    .gte("fecha_hora", desdeIso)
    .lte("fecha_hora", hastaIso);
  if (error) lanzar(error, "listarCitasParaRecordar");
  return (data ?? []) as Cita[];
}

export async function actualizarCita(
  id: string,
  cambios: Partial<{
    cliente_nombre: string;
    cliente_telefono: string | null;
    fecha_hora: string;
    duracion_min: number;
    tipo: string | null;
    estado: EstadoCita;
    notas: string | null;
    recordatorio_enviado: boolean;
  }>,
): Promise<Cita | null> {
  const { data, error } = await db()
    .from("citas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarCita");
  return data as Cita;
}

export async function borrarCita(id: string): Promise<void> {
  const { error } = await db().from("citas").delete().eq("id", id);
  if (error) lanzar(error, "borrarCita");
}

// ============================================================
// LLAMADAS VAPI
// ============================================================

export async function crearLlamadaVapi(
  cuentaId: string,
  conversacionId: string | null,
  vapiCallId: string,
  telefono: string,
  direccion: "saliente" | "entrante" = "saliente",
): Promise<LlamadaVapi> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      vapi_call_id: vapiCallId,
      telefono,
      direccion,
      estado: "iniciando",
    })
    .select()
    .single();
  if (error) lanzar(error, "crearLlamadaVapi");
  return data as LlamadaVapi;
}

export async function obtenerLlamadaPorId(
  id: string,
): Promise<LlamadaVapi | null> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLlamadaPorId");
  return (data as LlamadaVapi) ?? null;
}

export async function obtenerLlamadaPorCallId(
  vapiCallId: string,
): Promise<LlamadaVapi | null> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("vapi_call_id", vapiCallId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLlamadaPorCallId");
  return (data as LlamadaVapi) ?? null;
}

export async function listarLlamadasDeCuenta(
  cuentaId: string,
  limite = 100,
): Promise<LlamadaVapi[]> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("iniciada_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarLlamadasDeCuenta");
  return (data ?? []) as LlamadaVapi[];
}

export async function listarLlamadasDeConversacion(
  conversacionId: string,
): Promise<LlamadaVapi[]> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("iniciada_en", { ascending: false });
  if (error) lanzar(error, "listarLlamadasDeConversacion");
  return (data ?? []) as LlamadaVapi[];
}

export async function actualizarLlamadaPorCallId(
  vapiCallId: string,
  cambios: Partial<{
    estado: EstadoLlamada;
    transcripcion: string;
    resumen: string;
    audio_url: string;
    duracion_seg: number;
    costo_usd: number;
    terminada_en: string;
  }>,
): Promise<void> {
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (v !== undefined) limpio[k] = v;
  }
  if (Object.keys(limpio).length === 0) return;
  const { error } = await db()
    .from("llamadas_vapi")
    .update(limpio)
    .eq("vapi_call_id", vapiCallId);
  if (error) lanzar(error, "actualizarLlamadaPorCallId");
}

export async function borrarLlamada(id: string): Promise<void> {
  const { error } = await db().from("llamadas_vapi").delete().eq("id", id);
  if (error) lanzar(error, "borrarLlamada");
}

// ============================================================
// MÉTRICAS DEL DASHBOARD
// ============================================================

export async function obtenerMetricas(
  cuentaId: string,
): Promise<MetricasCuenta> {
  const ahora = new Date();
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const inicio7d = new Date(ahora.getTime() - 7 * 86400 * 1000);

  // Conversaciones (incluye lead tracking ahora)
  const { data: convs } = await db()
    .from("conversaciones")
    .select(
      "id, telefono, nombre, modo, necesita_humano, etapa_id, estado_lead, lead_score, ultimo_mensaje_en, datos_capturados",
    )
    .eq("cuenta_id", cuentaId);
  const arrConvs = (convs ?? []) as Array<{
    id: string;
    telefono: string;
    nombre: string | null;
    modo: ModoConversacion;
    necesita_humano: boolean;
    etapa_id: string | null;
    estado_lead: EstadoLead;
    lead_score: number;
    ultimo_mensaje_en: string | null;
    datos_capturados: DatosCapturados;
  }>;

  // Mensajes
  const { data: msgs } = await db()
    .from("mensajes")
    .select("rol, creado_en")
    .eq("cuenta_id", cuentaId);
  const arrMsgs = (msgs ?? []) as Array<{ rol: RolMensaje; creado_en: string }>;

  // Etapas + count por etapa
  const etapas = await listarEtapas(cuentaId);
  const conteoEtapa = new Map<string | null, number>();
  for (const c of arrConvs) {
    const k = c.etapa_id ?? null;
    conteoEtapa.set(k, (conteoEtapa.get(k) ?? 0) + 1);
  }
  const sinEtapa = conteoEtapa.get(null) ?? 0;
  const por_etapa = [
    ...(sinEtapa > 0
      ? [
          {
            etapa_id: null,
            nombre: "Sin asignar",
            color: "zinc",
            count: sinEtapa,
          },
        ]
      : []),
    ...etapas.map((e) => ({
      etapa_id: e.id,
      nombre: e.nombre,
      color: e.color,
      count: conteoEtapa.get(e.id) ?? 0,
    })),
  ];

  // Etiquetas con count
  const etiqAr = await listarEtiquetasConCount(cuentaId);
  const por_etiqueta = etiqAr.map((e) => ({
    etiqueta_id: e.id,
    nombre: e.nombre,
    color: e.color,
    count: e.conversaciones_count,
  }));

  // Mensajes por día (últimos 7)
  const porDia = new Map<string, number>();
  for (const m of arrMsgs) {
    const d = new Date(m.creado_en);
    if (d < inicio7d) continue;
    const key = d.toISOString().slice(0, 10);
    porDia.set(key, (porDia.get(key) ?? 0) + 1);
  }
  const mensajes_por_dia = Array.from(porDia.entries())
    .map(([dia, count]) => ({ dia, count }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  // Inversiones por moneda
  const { data: invs } = await db()
    .from("inversiones")
    .select("monto, moneda")
    .eq("cuenta_id", cuentaId);
  const invsMap = new Map<string, { total: number; n: number }>();
  for (const r of (invs ?? []) as Array<{ monto: number; moneda: string }>) {
    const cur = invsMap.get(r.moneda) ?? { total: 0, n: 0 };
    cur.total += Number(r.monto);
    cur.n += 1;
    invsMap.set(r.moneda, cur);
  }

  // Productos
  const { data: prods } = await db()
    .from("productos")
    .select("esta_activo, stock")
    .eq("cuenta_id", cuentaId);
  const productosTotal = (prods ?? []).length;
  const productosSinStock = ((prods ?? []) as Array<{
    esta_activo: boolean;
    stock: number | null;
  }>).filter(
    (p) => p.esta_activo && p.stock !== null && p.stock <= 0,
  ).length;

  // ===== CRM: distribución por estado del lead =====
  const ESTADOS_LEAD: EstadoLead[] = [
    "nuevo",
    "contactado",
    "calificado",
    "interesado",
    "negociacion",
    "cerrado",
    "perdido",
  ];
  const conteoEstado = new Map<EstadoLead, number>();
  for (const c of arrConvs) {
    const e = (c.estado_lead ?? "nuevo") as EstadoLead;
    conteoEstado.set(e, (conteoEstado.get(e) ?? 0) + 1);
  }
  const por_estado_lead = ESTADOS_LEAD.map((estado) => ({
    estado,
    count: conteoEstado.get(estado) ?? 0,
  }));

  const scoreSum = arrConvs.reduce((acc, c) => acc + (c.lead_score ?? 0), 0);
  const lead_score_promedio =
    arrConvs.length > 0 ? Math.round(scoreSum / arrConvs.length) : 0;

  const casi_a_confirmar = arrConvs.filter(
    (c) =>
      c.estado_lead === "negociacion" ||
      (c.lead_score ?? 0) >= 75,
  ).length;

  const cerrados = conteoEstado.get("cerrado") ?? 0;
  const perdidos = conteoEstado.get("perdido") ?? 0;
  const tasa_aceptacion =
    cerrados + perdidos > 0
      ? Math.round((cerrados / (cerrados + perdidos)) * 100)
      : 0;

  // Top 10 conversaciones que necesitan atención humana, ordenadas por
  // último mensaje desc para que el operador las vea por urgencia.
  const conversaciones_atencion = arrConvs
    .filter((c) => c.necesita_humano)
    .map((c) => ({
      conversacion_id: c.id,
      nombre:
        c.datos_capturados?.nombre?.trim() ||
        c.nombre ||
        `+${c.telefono}`,
      telefono: c.telefono,
      ultimo_mensaje_en: c.ultimo_mensaje_en,
      estado_lead: (c.estado_lead ?? "nuevo") as EstadoLead,
      lead_score: c.lead_score ?? 0,
    }))
    .sort((a, b) => {
      const ta = a.ultimo_mensaje_en ? new Date(a.ultimo_mensaje_en).getTime() : 0;
      const tb = b.ultimo_mensaje_en ? new Date(b.ultimo_mensaje_en).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 10);

  // ===== Citas =====
  const en7d = new Date(ahora.getTime() + 7 * 86400 * 1000);
  const { data: citasData } = await db()
    .from("citas")
    .select("estado, fecha_hora")
    .eq("cuenta_id", cuentaId);
  const citas = (citasData ?? []) as Array<{
    estado: EstadoCita;
    fecha_hora: string;
  }>;
  const citas_total = citas.length;
  const citas_proximas_7d = citas.filter((c) => {
    const f = new Date(c.fecha_hora);
    return (
      f >= ahora &&
      f <= en7d &&
      (c.estado === "agendada" || c.estado === "confirmada")
    );
  }).length;
  const citas_hoy = citas.filter((c) => {
    const f = new Date(c.fecha_hora);
    return (
      f >= inicioHoy &&
      f < new Date(inicioHoy.getTime() + 86400 * 1000) &&
      c.estado !== "cancelada"
    );
  }).length;
  const citas_realizadas = citas.filter((c) => c.estado === "realizada").length;
  const citas_canceladas = citas.filter((c) => c.estado === "cancelada").length;
  const citas_no_asistio = citas.filter((c) => c.estado === "no_asistio").length;
  const tasa_asistencia_citas =
    citas_realizadas + citas_canceladas + citas_no_asistio > 0
      ? Math.round(
          (citas_realizadas /
            (citas_realizadas + citas_canceladas + citas_no_asistio)) *
            100,
        )
      : 0;

  return {
    conversaciones_total: arrConvs.length,
    conversaciones_necesitan_humano: arrConvs.filter(
      (c) => c.necesita_humano,
    ).length,
    conversaciones_modo_ia: arrConvs.filter((c) => c.modo === "IA").length,
    conversaciones_modo_humano: arrConvs.filter((c) => c.modo === "HUMANO")
      .length,
    mensajes_total: arrMsgs.length,
    mensajes_recibidos: arrMsgs.filter((m) => m.rol === "usuario").length,
    mensajes_enviados_bot: arrMsgs.filter((m) => m.rol === "asistente").length,
    mensajes_enviados_humano: arrMsgs.filter((m) => m.rol === "humano").length,
    mensajes_hoy: arrMsgs.filter(
      (m) => new Date(m.creado_en) >= inicioHoy,
    ).length,
    mensajes_ultimos_7d: arrMsgs.filter((m) => new Date(m.creado_en) >= inicio7d)
      .length,
    emails_capturados: await contarContactosEmail(cuentaId),
    telefonos_capturados: await contarContactosTelefono(cuentaId),
    productos_total: productosTotal,
    productos_sin_stock: productosSinStock,
    inversiones_por_moneda: Array.from(invsMap.entries()).map(
      ([moneda, v]) => ({ moneda, total: v.total, n: v.n }),
    ),
    productos_top: await listarTopProductos(cuentaId, 5),
    por_etapa,
    por_etiqueta,
    mensajes_por_dia,
    por_estado_lead,
    lead_score_promedio,
    casi_a_confirmar,
    tasa_aceptacion,
    conversaciones_atencion,
    citas_total,
    citas_proximas_7d,
    citas_hoy,
    citas_realizadas,
    citas_canceladas,
    citas_no_asistio,
    tasa_asistencia_citas,
  };
}

// ============================================================
// ASSISTANTS VAPI (multi-assistant por cuenta)
// ============================================================

export async function listarAssistantsDeCuenta(
  cuentaId: string,
): Promise<AssistantVapi[]> {
  const { data, error } = await db()
    .from("assistants_vapi")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("es_default", { ascending: false })
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarAssistantsDeCuenta");
  return (data ?? []) as AssistantVapi[];
}

export async function obtenerAssistantLocal(
  id: string,
): Promise<AssistantVapi | null> {
  const { data, error } = await db()
    .from("assistants_vapi")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerAssistantLocal");
  return (data as AssistantVapi) ?? null;
}

export async function obtenerAssistantDefault(
  cuentaId: string,
): Promise<AssistantVapi | null> {
  const { data, error } = await db()
    .from("assistants_vapi")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("es_default", true)
    .maybeSingle();
  if (error) lanzar(error, "obtenerAssistantDefault");
  return (data as AssistantVapi) ?? null;
}

export async function crearAssistantLocal(
  cuentaId: string,
  datos: {
    nombre: string;
    prompt_extra?: string;
    primer_mensaje?: string;
    voz_elevenlabs?: string | null;
    modelo?: string;
    max_segundos?: number;
    grabar?: boolean;
    es_default?: boolean;
  },
): Promise<AssistantVapi> {
  // Si se marca como default, primero quitamos default de los demás
  // (el índice único parcial nos protege pero hacemos limpio).
  if (datos.es_default) {
    await db()
      .from("assistants_vapi")
      .update({ es_default: false })
      .eq("cuenta_id", cuentaId)
      .eq("es_default", true);
  }
  const { data, error } = await db()
    .from("assistants_vapi")
    .insert({
      cuenta_id: cuentaId,
      nombre: datos.nombre.trim(),
      prompt_extra: datos.prompt_extra ?? "",
      primer_mensaje: datos.primer_mensaje ?? "",
      voz_elevenlabs: datos.voz_elevenlabs ?? null,
      modelo: datos.modelo ?? "gpt-4o-mini",
      max_segundos: datos.max_segundos ?? 600,
      grabar: datos.grabar ?? true,
      es_default: datos.es_default ?? false,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearAssistantLocal");
  return data as AssistantVapi;
}

export async function actualizarAssistantLocal(
  id: string,
  cambios: Partial<{
    nombre: string;
    vapi_assistant_id: string | null;
    prompt_extra: string;
    primer_mensaje: string;
    voz_elevenlabs: string | null;
    modelo: string;
    max_segundos: number;
    grabar: boolean;
    es_default: boolean;
    esta_activo: boolean;
    sincronizado_en: string | null;
  }>,
): Promise<AssistantVapi | null> {
  // Si se está marcando como default, quitamos default a los hermanos.
  if (cambios.es_default === true) {
    const { data: actual } = await db()
      .from("assistants_vapi")
      .select("cuenta_id")
      .eq("id", id)
      .maybeSingle();
    if (actual) {
      await db()
        .from("assistants_vapi")
        .update({ es_default: false })
        .eq("cuenta_id", (actual as { cuenta_id: string }).cuenta_id)
        .neq("id", id);
    }
  }
  const { data, error } = await db()
    .from("assistants_vapi")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarAssistantLocal");
  return data as AssistantVapi;
}

export async function borrarAssistantLocal(id: string): Promise<void> {
  const { error } = await db()
    .from("assistants_vapi")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarAssistantLocal");
}

// ============================================================
// LLAMADAS PROGRAMADAS
// ============================================================

export async function crearLlamadaProgramada(
  cuentaId: string,
  datos: {
    conversacion_id?: string | null;
    assistant_id?: string | null;
    telefono_destino?: string | null;
    motivo?: string | null;
    origen?: "humano" | "ia";
    programada_para: string; // ISO
  },
): Promise<LlamadaProgramada> {
  const { data, error } = await db()
    .from("llamadas_programadas")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: datos.conversacion_id ?? null,
      assistant_id: datos.assistant_id ?? null,
      telefono_destino: datos.telefono_destino ?? null,
      motivo: datos.motivo ?? null,
      origen: datos.origen ?? "humano",
      programada_para: datos.programada_para,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearLlamadaProgramada");
  return data as LlamadaProgramada;
}

export async function listarLlamadasProgramadasDeCuenta(
  cuentaId: string,
): Promise<LlamadaProgramadaConContexto[]> {
  const { data, error } = await db()
    .from("llamadas_programadas")
    .select(
      `*,
       conversaciones (nombre, telefono),
       assistants_vapi (nombre)`,
    )
    .eq("cuenta_id", cuentaId)
    .order("programada_para", { ascending: true });
  if (error) lanzar(error, "listarLlamadasProgramadasDeCuenta");
  type Fila = LlamadaProgramada & {
    conversaciones: { nombre: string | null; telefono: string } | null;
    assistants_vapi: { nombre: string } | null;
  };
  return ((data ?? []) as Fila[]).map((f) => ({
    ...f,
    nombre_contacto: f.conversaciones?.nombre ?? null,
    telefono_conv: f.conversaciones?.telefono ?? null,
    assistant_nombre: f.assistants_vapi?.nombre ?? null,
  }));
}

/**
 * Llamadas pendientes cuya hora ya pasó. El scheduler las procesa
 * cada 30s y dispara el outbound a Vapi.
 */
export async function listarLlamadasProgramadasDue(): Promise<
  LlamadaProgramada[]
> {
  const ahora = new Date().toISOString();
  const { data, error } = await db()
    .from("llamadas_programadas")
    .select("*")
    .eq("estado", "pendiente")
    .lte("programada_para", ahora)
    .order("programada_para", { ascending: true })
    .limit(50);
  if (error) lanzar(error, "listarLlamadasProgramadasDue");
  return (data ?? []) as LlamadaProgramada[];
}

export async function marcarLlamadaProgramadaEjecutada(
  id: string,
  llamadaVapiId: string,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_programadas")
    .update({
      estado: "ejecutada",
      llamada_vapi_id: llamadaVapiId,
      ejecutada_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) lanzar(error, "marcarLlamadaProgramadaEjecutada");
}

export async function marcarLlamadaProgramadaFallida(
  id: string,
  razon: string,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_programadas")
    .update({
      estado: "fallida",
      razon_cancelacion: razon.slice(0, 500),
    })
    .eq("id", id);
  if (error) lanzar(error, "marcarLlamadaProgramadaFallida");
}

export async function cancelarLlamadaProgramada(
  id: string,
  razon: string,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_programadas")
    .update({
      estado: "cancelada",
      razon_cancelacion: razon.slice(0, 500),
    })
    .eq("id", id);
  if (error) lanzar(error, "cancelarLlamadaProgramada");
}

// ============================================================
// NOTIFICACIONES DEL SISTEMA
// ============================================================

export async function crearNotificacion(datos: {
  usuario_id: string;
  cuenta_id?: string | null;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  metadata?: Record<string, unknown> | null;
}): Promise<NotificacionSistema> {
  const { data, error } = await db()
    .from("notificaciones_sistema")
    .insert({
      usuario_id: datos.usuario_id,
      cuenta_id: datos.cuenta_id ?? null,
      tipo: datos.tipo,
      titulo: datos.titulo.slice(0, 200),
      mensaje: datos.mensaje.slice(0, 2000),
      metadata: datos.metadata ?? null,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearNotificacion");
  return data as NotificacionSistema;
}

export async function listarNotificacionesDeUsuario(
  usuarioId: string,
  limite = 50,
): Promise<NotificacionSistema[]> {
  const { data, error } = await db()
    .from("notificaciones_sistema")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("creada_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarNotificacionesDeUsuario");
  return (data ?? []) as NotificacionSistema[];
}

export async function contarNoLeidasDeUsuario(
  usuarioId: string,
): Promise<number> {
  const { count, error } = await db()
    .from("notificaciones_sistema")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("leida", false);
  if (error) lanzar(error, "contarNoLeidasDeUsuario");
  return count ?? 0;
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  const { error } = await db()
    .from("notificaciones_sistema")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq("id", id);
  if (error) lanzar(error, "marcarNotificacionLeida");
}

export async function marcarTodasLeidas(usuarioId: string): Promise<void> {
  const { error } = await db()
    .from("notificaciones_sistema")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq("usuario_id", usuarioId)
    .eq("leida", false);
  if (error) lanzar(error, "marcarTodasLeidas");
}

export async function marcarEmailEnviado(id: string): Promise<void> {
  const { error } = await db()
    .from("notificaciones_sistema")
    .update({ email_enviado: true })
    .eq("id", id);
  if (error) lanzar(error, "marcarEmailEnviado");
}

/**
 * Idempotencia: chequea si ya existe una notificación reciente
 * (último N minutos) del mismo tipo para la misma cuenta. Evita
 * spam si una cuenta se desconecta y reconecta varias veces.
 */
export async function existeNotificacionReciente(
  usuarioId: string,
  cuentaId: string,
  tipo: TipoNotificacion,
  minutos = 15,
): Promise<boolean> {
  const desde = new Date(Date.now() - minutos * 60_000).toISOString();
  const { count, error } = await db()
    .from("notificaciones_sistema")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("cuenta_id", cuentaId)
    .eq("tipo", tipo)
    .gte("creada_en", desde);
  if (error) lanzar(error, "existeNotificacionReciente");
  return (count ?? 0) > 0;
}
