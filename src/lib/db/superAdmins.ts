/**
 * DAO de super_admins (dueños/operadores del SaaS).
 * Estos son los users globales que reciben reportes y pueden controlar
 * toda la plataforma — distintos del "admin por cuenta" (cada user
 * dueño de su número WhatsApp).
 */
import { db, lanzar } from "./cliente";

export interface SuperAdmin {
  id: string;
  email: string;
  telefono_whatsapp: string;
  nombre: string | null;
  activo: boolean;
  ultimo_reporte_diario_en: string | null;
  creado_en: string;
}

/**
 * Lista todos los super-admins activos (los que reciben reportes).
 */
export async function listarSuperAdminsActivos(): Promise<SuperAdmin[]> {
  const { data, error } = await db()
    .from("super_admins")
    .select("*")
    .eq("activo", true)
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarSuperAdminsActivos");
  return (data ?? []) as SuperAdmin[];
}

/**
 * Busca un super-admin por su teléfono WhatsApp (E.164 sin "+").
 * Es la función crítica que el manejador Baileys consulta para
 * decidir si un mensaje entrante viene de un admin global.
 *
 * Devuelve null si el teléfono no pertenece a ningún admin activo.
 */
export async function obtenerSuperAdminPorTelefono(
  telefono: string,
): Promise<SuperAdmin | null> {
  if (!telefono) return null;
  const limpio = telefono.replace(/[^0-9]/g, "");
  if (!limpio) return null;
  const { data, error } = await db()
    .from("super_admins")
    .select("*")
    .eq("telefono_whatsapp", limpio)
    .eq("activo", true)
    .maybeSingle();
  if (error) lanzar(error, "obtenerSuperAdminPorTelefono");
  return (data as SuperAdmin) ?? null;
}

/**
 * Busca un super-admin por email (case-insensitive). Usado por el
 * guard del panel /admin para validar sesión Supabase.
 */
export async function obtenerSuperAdminPorEmail(
  email: string,
): Promise<SuperAdmin | null> {
  if (!email) return null;
  const { data, error } = await db()
    .from("super_admins")
    .select("*")
    .ilike("email", email.trim())
    .eq("activo", true)
    .maybeSingle();
  if (error) lanzar(error, "obtenerSuperAdminPorEmail");
  return (data as SuperAdmin) ?? null;
}

/**
 * Marca que un super-admin recibió el reporte diario hoy.
 * El cron diario chequea esto antes de mandar para no duplicar
 * si reinicia el proceso o el cron corre dos veces.
 */
export async function marcarReporteDiarioEnviado(
  superAdminId: string,
): Promise<void> {
  const { error } = await db()
    .from("super_admins")
    .update({ ultimo_reporte_diario_en: new Date().toISOString() })
    .eq("id", superAdminId);
  if (error) lanzar(error, "marcarReporteDiarioEnviado");
}

/**
 * Devuelve los super-admins que TODAVÍA no recibieron el reporte
 * de hoy. Usado por el cron diario para idempotencia.
 */
export async function listarSuperAdminsPendientesReporte(): Promise<SuperAdmin[]> {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const { data, error } = await db()
    .from("super_admins")
    .select("*")
    .eq("activo", true)
    .or(
      `ultimo_reporte_diario_en.is.null,ultimo_reporte_diario_en.lt.${inicioDia.toISOString()}`,
    );
  if (error) lanzar(error, "listarSuperAdminsPendientesReporte");
  return (data ?? []) as SuperAdmin[];
}
