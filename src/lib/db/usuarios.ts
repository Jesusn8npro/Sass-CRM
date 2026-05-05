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
