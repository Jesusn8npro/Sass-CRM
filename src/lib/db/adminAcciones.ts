/**
 * DAO de admin_acciones — audit trail de todo lo que ejecuta un
 * super-admin (comandos WhatsApp, acciones del panel, jobs cron).
 *
 * Tabla inmutable: solo INSERT y SELECT. Nunca UPDATE/DELETE — el
 * audit trail no se modifica.
 */
import { db, lanzar } from "./cliente";

export type OrigenAccionAdmin = "whatsapp" | "panel" | "cron";

export interface AccionAdmin {
  id: string;
  super_admin_id: string;
  origen: OrigenAccionAdmin;
  accion: string;
  payload: Record<string, unknown> | null;
  resultado: Record<string, unknown> | null;
  error: string | null;
  creado_en: string;
}

export interface ParamsRegistrarAccion {
  superAdminId: string;
  origen: OrigenAccionAdmin;
  accion: string;
  payload?: Record<string, unknown> | null;
  resultado?: Record<string, unknown> | null;
  error?: string | null;
}

/**
 * Registra una acción en el audit trail. Fire-and-forget en la
 * mayoría de los casos — si falla, solo loggeamos sin reventar
 * el flujo principal.
 */
export async function registrarAccionAdmin(
  params: ParamsRegistrarAccion,
): Promise<AccionAdmin | null> {
  const { data, error } = await db()
    .from("admin_acciones")
    .insert({
      super_admin_id: params.superAdminId,
      origen: params.origen,
      accion: params.accion,
      payload: params.payload ?? null,
      resultado: params.resultado ?? null,
      error: params.error ?? null,
    })
    .select()
    .single();
  if (error) {
    // No reventamos — el audit trail es importante pero no crítico
    // para el funcionamiento. Solo loggeamos.
    console.error("[adminAcciones] error registrando acción:", error);
    return null;
  }
  return data as AccionAdmin;
}

/**
 * Lista las últimas N acciones de un super-admin.
 * Usado por la página /admin/logs para mostrar historial.
 */
export async function listarAccionesAdmin(
  superAdminId: string,
  limite = 50,
): Promise<AccionAdmin[]> {
  const lim = Math.max(1, Math.min(500, Math.floor(limite)));
  const { data, error } = await db()
    .from("admin_acciones")
    .select("*")
    .eq("super_admin_id", superAdminId)
    .order("creado_en", { ascending: false })
    .limit(lim);
  if (error) lanzar(error, "listarAccionesAdmin");
  return (data ?? []) as AccionAdmin[];
}
