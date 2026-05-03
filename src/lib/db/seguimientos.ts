import { db, lanzar } from "./cliente";
import type { SeguimientoConContacto, SeguimientoProgramado } from "./tipos";

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
  return (
    (data ?? []) as Array<
      SeguimientoProgramado & {
        conversaciones: { nombre: string | null; telefono: string } | null;
      }
    >
  ).map((r) => ({
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
