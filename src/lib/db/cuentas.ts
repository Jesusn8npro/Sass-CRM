import { db, lanzar } from "./cliente";
import { PROMPT_SISTEMA_DEFAULT } from "../promptSistema";
import { sembrarEtapasSiVacias } from "./etapas";
import { cache, TTL } from "@/lib/cache";
import type { CampoCaptura, Cuenta, EstadoConexion } from "./tipos";

/**
 * Lista las cuentas de un usuario (excluye archivadas).
 * Si no se pasa usuarioId, lista TODAS (uso interno del bot).
 */
export async function listarCuentas(usuarioId?: string): Promise<Cuenta[]> {
  // Lista global (sin userId) usada por el bot cada 20-30s — cacheable
  if (!usuarioId) {
    const cached = cache.get<Cuenta[]>("cuentas:activas");
    if (cached) return cached;
  }
  let q = db()
    .from("cuentas")
    .select("*")
    .eq("esta_archivada", false)
    .order("creada_en", { ascending: true });
  if (usuarioId) q = q.eq("usuario_id", usuarioId);
  const { data, error } = await q;
  if (error) lanzar(error, "listarCuentas");
  const result = (data ?? []) as Cuenta[];
  if (!usuarioId) cache.set("cuentas:activas", result, TTL.CUENTAS_LISTA);
  return result;
}

export async function obtenerCuenta(id: string): Promise<Cuenta | null> {
  const cacheKey = `cuenta:${id}`;
  const cached = cache.get<Cuenta>(cacheKey);
  if (cached) return cached;
  const { data, error } = await db()
    .from("cuentas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCuenta");
  const result = (data as Cuenta) ?? null;
  if (result) cache.set(cacheKey, result, TTL.CUENTA);
  return result;
}

export async function obtenerCuentaPorAssistantId(assistantId: string): Promise<Cuenta | null> {
  const { data, error } = await db()
    .from("cuentas")
    .select("*")
    .eq("vapi_assistant_id", assistantId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCuentaPorAssistantId");
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
    esta_activa: boolean;
    delay_entre_partes_segundos: number;
    mensajes_contexto: number;
    memoria_largo_plazo: boolean;
    telefono_operador_privado: string | null;
    operador_privado_resumen_diario: boolean;
    operador_privado_alertas: boolean;
    notificaciones_email_activas: boolean;
    responder_humanizado: boolean;
    usar_emojis: boolean;
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
  if (cambios.delay_entre_partes_segundos !== undefined) {
    const v = Number(cambios.delay_entre_partes_segundos);
    cambios.delay_entre_partes_segundos = Number.isFinite(v)
      ? Math.max(0, Math.min(30, v))
      : 3;
  }
  if (cambios.mensajes_contexto !== undefined) {
    cambios.mensajes_contexto = Math.max(
      5,
      Math.min(200, Math.floor(cambios.mensajes_contexto as number)),
    );
  }
  if (cambios.telefono_operador_privado !== undefined && cambios.telefono_operador_privado !== null) {
    // Sanitizar a sólo dígitos (sin '+' ni espacios) — el bot lo concatena con
    // '@s.whatsapp.net' para el JID de Baileys.
    const tel = String(cambios.telefono_operador_privado).replace(/[^0-9]/g, "");
    cambios.telefono_operador_privado = tel.length >= 8 ? tel : null;
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
  // Invalidar cache para que la próxima lectura traiga datos frescos
  cache.del(`cuenta:${id}`);
  cache.del("cuentas:activas");
  return data as Cuenta;
}

export async function archivarCuenta(id: string): Promise<void> {
  const { error } = await db()
    .from("cuentas")
    .update({ esta_archivada: true })
    .eq("id", id);
  if (error) lanzar(error, "archivarCuenta");
  cache.del(`cuenta:${id}`);
  cache.del("cuentas:activas");
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

/**
 * (ADMIN) Cuenta cuántas cuentas tienen heartbeat reciente — proxy de
 * "cuentas activas" en el panel global. `umbralSegundos` define la
 * ventana hacia atrás contra el reloj UNIX guardado en `ultimo_heartbeat`.
 */
export async function contarCuentasActivasGlobal(
  umbralSegundos: number,
): Promise<number> {
  const limite = Math.floor(Date.now() / 1000) - umbralSegundos;
  const { count, error } = await db()
    .from("cuentas")
    .select("id", { count: "exact", head: true })
    .eq("esta_archivada", false)
    .gte("ultimo_heartbeat", limite);
  if (error) lanzar(error, "contarCuentasActivasGlobal");
  return count ?? 0;
}

/**
 * (ADMIN) Lista las cuentas (no archivadas) de un usuario para el
 * detalle de admin. Distinto de `listarCuentas(usuarioId)` solo en que
 * incluye archivadas si así se indica.
 */
export async function listarCuentasDeUsuarioAdmin(
  usuarioId: string,
  incluirArchivadas = false,
): Promise<Cuenta[]> {
  let q = db()
    .from("cuentas")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("creada_en", { ascending: true });
  if (!incluirArchivadas) q = q.eq("esta_archivada", false);
  const { data, error } = await q;
  if (error) lanzar(error, "listarCuentasDeUsuarioAdmin");
  return (data ?? []) as Cuenta[];
}

/**
 * Devuelve la cuenta marcada actualmente como `es_panel_admin = true`.
 * Solo debería haber UNA cuenta panel admin a la vez (la lógica de
 * marcado garantiza eso). Si no hay ninguna, devuelve null.
 */
export async function obtenerCuentaPanelAdmin(): Promise<Cuenta | null> {
  const { data, error } = await db()
    .from("cuentas")
    .select("*")
    .eq("es_panel_admin", true)
    .eq("esta_archivada", false)
    .limit(1)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCuentaPanelAdmin");
  return (data ?? null) as Cuenta | null;
}

/**
 * Marca una cuenta como canal admin global. Garantiza exclusividad:
 * primero desmarca cualquier otra cuenta que tuviera el flag y después
 * marca la nueva. Operación idempotente — si la cuenta ya era panel
 * admin, no hace nada extra.
 */
export async function marcarCuentaComoPanelAdmin(
  cuentaId: string,
): Promise<void> {
  // Desmarcar TODAS las cuentas (incluida la archivada, por las dudas)
  const { error: errDesmarca } = await db()
    .from("cuentas")
    .update({ es_panel_admin: false })
    .eq("es_panel_admin", true)
    .neq("id", cuentaId);
  if (errDesmarca) lanzar(errDesmarca, "marcarCuentaComoPanelAdmin:desmarcar");

  // Marcar la nueva
  const { error: errMarca } = await db()
    .from("cuentas")
    .update({ es_panel_admin: true })
    .eq("id", cuentaId);
  if (errMarca) lanzar(errMarca, "marcarCuentaComoPanelAdmin:marcar");
}

/**
 * Quita el flag de panel admin de una cuenta. Si no era panel admin,
 * el update no afecta filas — no es error.
 */
export async function desmarcarCuentaComoPanelAdmin(
  cuentaId: string,
): Promise<void> {
  const { error } = await db()
    .from("cuentas")
    .update({ es_panel_admin: false })
    .eq("id", cuentaId);
  if (error) lanzar(error, "desmarcarCuentaComoPanelAdmin");
}

export interface CuentaConOwnerEmail {
  id: string;
  etiqueta: string;
  estado: string;
  telefono: string | null;
  creado_en: string;
  usuario_id: string;
  owner_email: string | null;
}

export async function listarTodasLasCuentasAdmin(): Promise<CuentaConOwnerEmail[]> {
  const { data, error } = await db()
    .from("cuentas")
    .select("id, etiqueta, estado, telefono, creado_en, usuario_id, usuarios(email)")
    .order("creado_en", { ascending: false });
  if (error) lanzar(error, "listarTodasLasCuentasAdmin");
  return ((data ?? []) as unknown as Array<{
    id: string; etiqueta: string; estado: string; telefono: string | null;
    creado_en: string; usuario_id: string;
    usuarios: { email: string } | null;
  }>).map((c) => ({
    id: c.id,
    etiqueta: c.etiqueta,
    estado: c.estado,
    telefono: c.telefono,
    creado_en: c.creado_en,
    usuario_id: c.usuario_id,
    owner_email: c.usuarios?.email ?? null,
  }));
}
