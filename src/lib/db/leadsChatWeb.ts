/**
 * Leads capturados por el chat/formulario web del cliente (multi-tenant).
 * El widget del cliente ingresa leads vía /api/chat-web/lead usando el
 * token_chat_web de su cuenta. Cada cuenta ve y gestiona SOLO sus leads.
 *
 * Usa el cliente Supabase (`db()`, service_role) como el resto de la capa DB.
 */
import { randomBytes } from "node:crypto";
import { db, lanzar } from "./cliente";

export interface LeadChatWeb {
  id: string;
  cuenta_id: string;
  nombre: string | null;
  email: string | null;
  whatsapp: string | null;
  interes: string | null;
  mensaje: string | null;
  origen_url: string | null;
  mensaje_sugerido: string | null;
  extra: Record<string, unknown>;
  estado: "nuevo" | "enviado" | "descartado" | "error";
  error_envio: string | null;
  created_at: string;
  enviado_at: string | null;
}

/** Resuelve la cuenta dueña de un token de chat web (para ingesta sin sesión). */
export async function obtenerCuentaPorTokenChatWeb(token: string): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await db()
    .from("cuentas")
    .select("id")
    .eq("token_chat_web", token)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCuentaPorTokenChatWeb");
  return (data as { id: string } | null)?.id ?? null;
}

/** Token de la cuenta (puede ser null si aún no se generó). */
export async function obtenerTokenChatWeb(cuentaId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("cuentas")
    .select("token_chat_web")
    .eq("id", cuentaId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerTokenChatWeb");
  return (data as { token_chat_web: string | null } | null)?.token_chat_web ?? null;
}

/** Genera (o rota) el token de chat web de la cuenta y lo devuelve. */
export async function generarTokenChatWeb(cuentaId: string): Promise<string> {
  const token = "cw_" + randomBytes(20).toString("hex");
  const { error } = await db()
    .from("cuentas")
    .update({ token_chat_web: token })
    .eq("id", cuentaId);
  if (error) lanzar(error, "generarTokenChatWeb");
  return token;
}

export async function crearLeadChatWeb(d: {
  cuenta_id: string;
  nombre?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  interes?: string | null;
  mensaje?: string | null;
  origen_url?: string | null;
  mensaje_sugerido?: string | null;
  extra?: Record<string, unknown>;
}): Promise<LeadChatWeb> {
  const { data, error } = await db()
    .from("leads_chat_web")
    .insert({
      cuenta_id: d.cuenta_id,
      nombre: d.nombre ?? null,
      email: d.email ?? null,
      whatsapp: d.whatsapp ?? null,
      interes: d.interes ?? null,
      mensaje: d.mensaje ?? null,
      origen_url: d.origen_url ?? null,
      mensaje_sugerido: d.mensaje_sugerido ?? null,
      extra: d.extra ?? {},
    })
    .select("*")
    .single();
  if (error) lanzar(error, "crearLeadChatWeb");
  return data as LeadChatWeb;
}

export async function listarLeadsChatWeb(cuentaId: string, estado?: string): Promise<LeadChatWeb[]> {
  let q = db()
    .from("leads_chat_web")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) lanzar(error, "listarLeadsChatWeb");
  return (data ?? []) as LeadChatWeb[];
}

/** Obtiene un lead validando que pertenezca a la cuenta (defensa multi-tenant). */
export async function obtenerLeadChatWeb(cuentaId: string, id: string): Promise<LeadChatWeb | null> {
  const { data, error } = await db()
    .from("leads_chat_web")
    .select("*")
    .eq("id", id)
    .eq("cuenta_id", cuentaId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLeadChatWeb");
  return (data as LeadChatWeb) ?? null;
}

export async function marcarLeadChatWeb(
  cuentaId: string,
  id: string,
  estado: "enviado" | "descartado" | "error",
  errorEnvio?: string | null,
): Promise<void> {
  const { error } = await db()
    .from("leads_chat_web")
    .update({
      estado,
      error_envio: errorEnvio ?? null,
      enviado_at: estado === "enviado" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "marcarLeadChatWeb");
}
