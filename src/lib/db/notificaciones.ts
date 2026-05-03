import { db, lanzar } from "./cliente";
import type { NotificacionSistema, TipoNotificacion } from "./tipos";

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
 * (último N minutos) del mismo tipo para la misma cuenta. Evita spam.
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
