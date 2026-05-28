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
 * Marca atómicamente como enviados los super-admins que todavía
 * no recibieron el reporte de hoy, y los devuelve para procesar.
 *
 * Al hacer UPDATE…RETURNING en una sola sentencia PostgreSQL,
 * se elimina la ventana de race condition que existía con el patrón
 * SELECT…luego UPDATE: si dos procesos corren en paralelo, solo uno
 * ganará la fila (el segundo no encontrará filas que cumplan el WHERE).
 */
/**
 * (ADMIN) Lista TODOS los super-admins, activos o no, para el panel.
 */
export async function listarSuperAdminsAdmin(): Promise<SuperAdmin[]> {
  const { data, error } = await db()
    .from("super_admins")
    .select("*")
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarSuperAdminsAdmin");
  return (data ?? []) as SuperAdmin[];
}

/**
 * (ADMIN) Crea un super-admin nuevo. `telefono_whatsapp` se sanitiza a
 * solo dígitos (E.164 sin "+"). Email se normaliza a lowercase trim.
 * Si ya existe un super-admin con ese email o teléfono, devuelve error.
 */
export async function crearSuperAdminAdmin(p: {
  email: string;
  telefonoWhatsapp: string;
  nombre?: string | null;
}): Promise<SuperAdmin> {
  const email = p.email.trim().toLowerCase();
  const telefono = p.telefonoWhatsapp.replace(/[^0-9]/g, "");
  if (!email || !email.includes("@")) {
    throw new Error("[db:crearSuperAdmin] email inválido");
  }
  if (telefono.length < 8) {
    throw new Error("[db:crearSuperAdmin] telefono_whatsapp inválido (mín 8 dígitos)");
  }
  const { data, error } = await db()
    .from("super_admins")
    .insert({
      email,
      telefono_whatsapp: telefono,
      nombre: p.nombre?.trim() || null,
      activo: true,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearSuperAdminAdmin");
  return data as SuperAdmin;
}

/**
 * (ADMIN) Actualiza email/telefono/nombre/activo de un super-admin.
 * Cada campo es opcional. Sanitiza telefono igual que en crear.
 */
export async function actualizarSuperAdminAdmin(
  id: string,
  cambios: Partial<{
    email: string;
    telefono_whatsapp: string;
    nombre: string | null;
    activo: boolean;
  }>,
): Promise<SuperAdmin> {
  const upd: Record<string, unknown> = {};
  if (cambios.email !== undefined) {
    const v = cambios.email.trim().toLowerCase();
    if (!v || !v.includes("@")) {
      throw new Error("[db:actualizarSuperAdmin] email inválido");
    }
    upd.email = v;
  }
  if (cambios.telefono_whatsapp !== undefined) {
    const v = cambios.telefono_whatsapp.replace(/[^0-9]/g, "");
    if (v.length < 8) {
      throw new Error("[db:actualizarSuperAdmin] telefono inválido");
    }
    upd.telefono_whatsapp = v;
  }
  if (cambios.nombre !== undefined) {
    upd.nombre = cambios.nombre?.trim() || null;
  }
  if (cambios.activo !== undefined) upd.activo = cambios.activo;
  if (Object.keys(upd).length === 0) {
    const { data } = await db().from("super_admins").select("*").eq("id", id).single();
    return data as SuperAdmin;
  }
  const { data, error } = await db()
    .from("super_admins")
    .update(upd)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarSuperAdminAdmin");
  return data as SuperAdmin;
}

/**
 * (ADMIN) Borra un super-admin. Operación irreversible.
 * Las admin_acciones quedan huérfanas (sin FK al super-admin si existe)
 * — eso es decisión del schema actual.
 */
export async function eliminarSuperAdminAdmin(id: string): Promise<void> {
  const { error } = await db().from("super_admins").delete().eq("id", id);
  if (error) lanzar(error, "eliminarSuperAdminAdmin");
}

export async function reclamarSuperAdminsPendientesReporte(
  inicioDia: Date,
): Promise<SuperAdmin[]> {
  const { data, error } = await db()
    .from("super_admins")
    .update({ ultimo_reporte_diario_en: new Date().toISOString() })
    .eq("activo", true)
    .or(
      `ultimo_reporte_diario_en.is.null,ultimo_reporte_diario_en.lt.${inicioDia.toISOString()}`,
    )
    .select("*");
  if (error) lanzar(error, "reclamarSuperAdminsPendientesReporte");
  return (data ?? []) as SuperAdmin[];
}
