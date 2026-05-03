import { db, lanzar } from "./cliente";
import type { Cita, EstadoCita } from "./tipos";

export async function crearCita(
  cuentaId: string,
  datos: {
    conversacion_id?: string | null;
    cliente_nombre: string;
    cliente_telefono?: string | null;
    fecha_hora: string; // ISO
    duracion_min?: number;
    tipo?: string | null;
    notas?: string | null;
  },
): Promise<Cita> {
  const { data, error } = await db()
    .from("citas")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: datos.conversacion_id ?? null,
      cliente_nombre: datos.cliente_nombre,
      cliente_telefono: datos.cliente_telefono ?? null,
      fecha_hora: datos.fecha_hora,
      duracion_min: datos.duracion_min ?? 30,
      tipo: datos.tipo ?? null,
      notas: datos.notas ?? null,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearCita");
  return data as Cita;
}

export async function obtenerCita(id: string): Promise<Cita | null> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCita");
  return (data as Cita) ?? null;
}

export async function listarCitasDeCuenta(cuentaId: string): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("fecha_hora", { ascending: true });
  if (error) lanzar(error, "listarCitasDeCuenta");
  return (data ?? []) as Cita[];
}

/** Citas activas (agendada/confirmada) de UNA conversación, futuras.
 * Se inyectan al prompt de la IA: "estas son las citas que tiene este
 * cliente, podés referirte a ellas por id si las quiere cancelar
 * o reprogramar". */
export async function listarCitasActivasDeConversacion(
  conversacionId: string,
): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .in("estado", ["agendada", "confirmada"])
    .gte("fecha_hora", new Date().toISOString())
    .order("fecha_hora", { ascending: true });
  if (error) lanzar(error, "listarCitasActivasDeConversacion");
  return (data ?? []) as Cita[];
}

export async function listarCitasParaRecordar(
  desdeIso: string,
  hastaIso: string,
): Promise<Cita[]> {
  const { data, error } = await db()
    .from("citas")
    .select("*")
    .in("estado", ["agendada", "confirmada"])
    .eq("recordatorio_enviado", false)
    .gte("fecha_hora", desdeIso)
    .lte("fecha_hora", hastaIso);
  if (error) lanzar(error, "listarCitasParaRecordar");
  return (data ?? []) as Cita[];
}

export async function actualizarCita(
  id: string,
  cambios: Partial<{
    cliente_nombre: string;
    cliente_telefono: string | null;
    fecha_hora: string;
    duracion_min: number;
    tipo: string | null;
    estado: EstadoCita;
    notas: string | null;
    recordatorio_enviado: boolean;
  }>,
): Promise<Cita | null> {
  const { data, error } = await db()
    .from("citas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarCita");
  return data as Cita;
}

export async function borrarCita(id: string): Promise<void> {
  const { error } = await db().from("citas").delete().eq("id", id);
  if (error) lanzar(error, "borrarCita");
}
