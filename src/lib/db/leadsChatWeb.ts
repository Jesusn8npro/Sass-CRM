/**
 * Leads capturados por el chat/formulario web del cliente (multi-tenant).
 * El widget del cliente ingresa leads vía /api/chat-web/lead usando el
 * token_chat_web de su cuenta. Cada cuenta ve y gestiona SOLO sus leads.
 */
import { sql } from "./sql";

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
  const filas = await sql()<{ id: string }[]>`
    select id from cuentas where token_chat_web = ${token} limit 1`;
  return filas[0]?.id ?? null;
}

/** Token de la cuenta (puede ser null si aún no se generó). */
export async function obtenerTokenChatWeb(cuentaId: string): Promise<string | null> {
  const filas = await sql()<{ token_chat_web: string | null }[]>`
    select token_chat_web from cuentas where id = ${cuentaId}`;
  return filas[0]?.token_chat_web ?? null;
}

/** Genera (o rota) el token de chat web de la cuenta y lo devuelve. */
export async function generarTokenChatWeb(cuentaId: string): Promise<string> {
  const filas = await sql()<{ token_chat_web: string }[]>`
    update cuentas
    set token_chat_web = 'cw_' || encode(gen_random_bytes(20), 'hex')
    where id = ${cuentaId}
    returning token_chat_web`;
  return filas[0].token_chat_web;
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
  extra?: unknown;
}): Promise<LeadChatWeb> {
  const filas = await sql()<LeadChatWeb[]>`
    insert into leads_chat_web (
      cuenta_id, nombre, email, whatsapp, interes, mensaje, origen_url, mensaje_sugerido, extra
    ) values (
      ${d.cuenta_id}, ${d.nombre ?? null}, ${d.email ?? null}, ${d.whatsapp ?? null},
      ${d.interes ?? null}, ${d.mensaje ?? null}, ${d.origen_url ?? null},
      ${d.mensaje_sugerido ?? null}, ${JSON.stringify(d.extra ?? {})}::jsonb
    )
    returning *`;
  return filas[0];
}

export async function listarLeadsChatWeb(cuentaId: string, estado?: string): Promise<LeadChatWeb[]> {
  if (estado) {
    return await sql()<LeadChatWeb[]>`
      select * from leads_chat_web
      where cuenta_id = ${cuentaId} and estado = ${estado}
      order by created_at desc limit 300`;
  }
  return await sql()<LeadChatWeb[]>`
    select * from leads_chat_web
    where cuenta_id = ${cuentaId}
    order by created_at desc limit 300`;
}

/** Obtiene un lead validando que pertenezca a la cuenta (defensa multi-tenant). */
export async function obtenerLeadChatWeb(cuentaId: string, id: string): Promise<LeadChatWeb | null> {
  const filas = await sql()<LeadChatWeb[]>`
    select * from leads_chat_web where id = ${id} and cuenta_id = ${cuentaId}`;
  return filas[0] ?? null;
}

export async function marcarLeadChatWeb(
  cuentaId: string,
  id: string,
  estado: "enviado" | "descartado" | "error",
  errorEnvio?: string | null,
): Promise<void> {
  await sql()`
    update leads_chat_web
    set estado = ${estado},
        error_envio = ${errorEnvio ?? null},
        enviado_at = ${estado === "enviado" ? new Date().toISOString() : null}
    where id = ${id} and cuenta_id = ${cuentaId}`;
}
