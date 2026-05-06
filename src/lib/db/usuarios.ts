import { db, lanzar } from "./cliente";
import type { UsuarioApp } from "./tipos";

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

/**
 * Activa/renueva un plan de suscripción para un usuario. Idempotente:
 * si ya estaba en ese plan, sólo actualiza vence_en.
 */
export async function activarPlanUsuario(p: {
  usuarioId: string;
  plan: "free" | "pro" | "business";
  paypalSubscriptionId?: string | null;
  paypalPlanId?: string | null;
  venceEn: string;
}): Promise<void> {
  const cambios: Record<string, unknown> = {
    plan: p.plan,
    estado_billing: "activo",
    pasarela: p.plan === "free" ? null : "paypal",
    vence_en: p.venceEn,
  };
  if (p.paypalSubscriptionId !== undefined) {
    cambios.paypal_subscription_id = p.paypalSubscriptionId;
    cambios.pasarela_customer_id = p.paypalSubscriptionId;
  }
  if (p.paypalPlanId !== undefined) cambios.paypal_plan_id = p.paypalPlanId;
  const { error } = await db().from("usuarios").update(cambios).eq("id", p.usuarioId);
  if (error) lanzar(error, "activarPlanUsuario");
}

export async function marcarBillingUsuario(
  usuarioId: string,
  estado: "activo" | "suspendido" | "impago" | "prueba",
): Promise<void> {
  const { error } = await db()
    .from("usuarios")
    .update({ estado_billing: estado })
    .eq("id", usuarioId);
  if (error) lanzar(error, "marcarBillingUsuario");
}

/**
 * (ADMIN ONLY) Setea las cuentas WhatsApp adicionales otorgadas
 * manualmente al usuario sobre el cupo de su plan. El check del
 * límite en /api/cuentas suma plan.limite_cuentas + cuentas_extra_admin.
 *
 * Validación de admin la hace el caller (route handler con
 * requerirAdmin) — esta función NO valida.
 */
export async function setCuentasExtraAdmin(
  usuarioId: string,
  cantidad: number,
): Promise<UsuarioApp | null> {
  const valor = Math.max(0, Math.min(100, Math.floor(cantidad)));
  const { data, error } = await db()
    .from("usuarios")
    .update({ cuentas_extra_admin: valor })
    .eq("id", usuarioId)
    .select()
    .single();
  if (error) lanzar(error, "setCuentasExtraAdmin");
  return (data as UsuarioApp) ?? null;
}

export async function obtenerUsuarioPorSubscriptionId(
  subId: string,
): Promise<UsuarioApp | null> {
  const { data, error } = await db()
    .from("usuarios")
    .select("*")
    .eq("paypal_subscription_id", subId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerUsuarioPorSubscriptionId");
  return (data as UsuarioApp) ?? null;
}

// ============================================================
// ADMIN — listados globales para panel /app/admin
// ============================================================

export interface FiltroListadoUsuarios {
  busqueda?: string;
  plan?: "free" | "pro" | "business";
  estadoBilling?: "activo" | "suspendido" | "impago" | "prueba";
  offset?: number;
  limite?: number;
}

export interface FilaListadoUsuario extends UsuarioApp {
  total_cuentas: number;
}

/**
 * Listado paginado de usuarios para el panel admin. El conteo de
 * cuentas se calcula en una segunda query agrupada (no hay JOIN
 * agregado en supabase-js plano).
 */
export async function listarUsuariosPaginado(
  filtros: FiltroListadoUsuarios = {},
): Promise<{ usuarios: FilaListadoUsuario[]; total: number }> {
  const limite = Math.min(Math.max(filtros.limite ?? 20, 1), 100);
  const offset = Math.max(filtros.offset ?? 0, 0);

  let q = db()
    .from("usuarios")
    .select("*", { count: "exact" })
    .order("creado_en", { ascending: false });

  if (filtros.busqueda && filtros.busqueda.trim()) {
    q = q.ilike("email", `%${filtros.busqueda.trim()}%`);
  }
  if (filtros.plan) q = q.eq("plan", filtros.plan);
  if (filtros.estadoBilling) q = q.eq("estado_billing", filtros.estadoBilling);

  const { data, error, count } = await q.range(offset, offset + limite - 1);
  if (error) lanzar(error, "listarUsuariosPaginado");

  const filas = (data ?? []) as UsuarioApp[];
  if (filas.length === 0) {
    return { usuarios: [], total: count ?? 0 };
  }

  // Conteo de cuentas no archivadas por usuario.
  const ids = filas.map((u) => u.id);
  const { data: cuentas, error: errCuentas } = await db()
    .from("cuentas")
    .select("usuario_id")
    .in("usuario_id", ids)
    .eq("esta_archivada", false);
  if (errCuentas) lanzar(errCuentas, "listarUsuariosPaginado.cuentas");

  const conteo = new Map<string, number>();
  for (const c of (cuentas ?? []) as { usuario_id: string }[]) {
    conteo.set(c.usuario_id, (conteo.get(c.usuario_id) ?? 0) + 1);
  }

  const usuarios: FilaListadoUsuario[] = filas.map((u) => ({
    ...u,
    total_cuentas: conteo.get(u.id) ?? 0,
  }));

  return { usuarios, total: count ?? usuarios.length };
}

export interface ConteoPorPlan {
  free: number;
  pro: number;
  business: number;
}

export async function contarUsuariosPorPlan(): Promise<ConteoPorPlan> {
  const { data, error } = await db().from("usuarios").select("plan");
  if (error) lanzar(error, "contarUsuariosPorPlan");
  const acc: ConteoPorPlan = { free: 0, pro: 0, business: 0 };
  for (const fila of (data ?? []) as { plan: string }[]) {
    if (fila.plan === "pro") acc.pro += 1;
    else if (fila.plan === "business") acc.business += 1;
    else acc.free += 1;
  }
  return acc;
}

// ============================================================
// Onboarding (migración 09)
// ============================================================

export type PasoOnboarding = "conectar" | "plantilla" | "productos" | "probar";

/**
 * Estado mínimo de onboarding del usuario. Lee dos columnas que se
 * agregan en la migración 09. Si la migración aún no corrió, devuelve
 * defaults seguros (no completo, sin paso) para no romper el panel.
 */
export async function obtenerEstadoOnboarding(
  usuarioId: string,
): Promise<{ completo: boolean; paso: PasoOnboarding | null }> {
  const { data, error } = await db()
    .from("usuarios")
    .select("completo_onboarding, onboarding_paso")
    .eq("id", usuarioId)
    .maybeSingle();
  if (error) {
    // Si la columna aún no existe (migración pendiente), devolvemos
    // defaults seguros en vez de romper el panel.
    return { completo: false, paso: null };
  }
  const fila = data as
    | { completo_onboarding?: boolean; onboarding_paso?: string | null }
    | null;
  const pasoRaw = fila?.onboarding_paso ?? null;
  const paso: PasoOnboarding | null =
    pasoRaw === "conectar" ||
    pasoRaw === "plantilla" ||
    pasoRaw === "productos" ||
    pasoRaw === "probar"
      ? pasoRaw
      : null;
  return { completo: !!fila?.completo_onboarding, paso };
}

export async function guardarPasoOnboarding(
  usuarioId: string,
  paso: PasoOnboarding | null,
): Promise<void> {
  const { error } = await db()
    .from("usuarios")
    .update({ onboarding_paso: paso })
    .eq("id", usuarioId);
  if (error) lanzar(error, "guardarPasoOnboarding");
}

export async function marcarOnboardingCompleto(
  usuarioId: string,
): Promise<void> {
  const { error } = await db()
    .from("usuarios")
    .update({ completo_onboarding: true, onboarding_paso: null })
    .eq("id", usuarioId);
  if (error) lanzar(error, "marcarOnboardingCompleto");
}
