import { db, lanzar } from "./cliente";
import type { LlamadaProgramada, LlamadaProgramadaConContexto } from "./tipos";

export async function crearLlamadaProgramada(
  cuentaId: string,
  datos: {
    conversacion_id?: string | null;
    assistant_id?: string | null;
    telefono_destino?: string | null;
    motivo?: string | null;
    origen?: "humano" | "ia";
    programada_para: string; // ISO
  },
): Promise<LlamadaProgramada> {
  const { data, error } = await db()
    .from("llamadas_programadas")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: datos.conversacion_id ?? null,
      assistant_id: datos.assistant_id ?? null,
      telefono_destino: datos.telefono_destino ?? null,
      motivo: datos.motivo ?? null,
      origen: datos.origen ?? "humano",
      programada_para: datos.programada_para,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearLlamadaProgramada");
  return data as LlamadaProgramada;
}

export async function listarLlamadasProgramadasDeCuenta(
  cuentaId: string,
): Promise<LlamadaProgramadaConContexto[]> {
  const { data, error } = await db()
    .from("llamadas_programadas")
    .select(
      `*,
       conversaciones (nombre, telefono),
       assistants_vapi (nombre)`,
    )
    .eq("cuenta_id", cuentaId)
    .order("programada_para", { ascending: true });
  if (error) lanzar(error, "listarLlamadasProgramadasDeCuenta");
  type Fila = LlamadaProgramada & {
    conversaciones: { nombre: string | null; telefono: string } | null;
    assistants_vapi: { nombre: string } | null;
  };
  return ((data ?? []) as Fila[]).map((f) => ({
    ...f,
    nombre_contacto: f.conversaciones?.nombre ?? null,
    telefono_conv: f.conversaciones?.telefono ?? null,
    assistant_nombre: f.assistants_vapi?.nombre ?? null,
  }));
}

/**
 * Llamadas pendientes cuya hora ya pasó. El scheduler las procesa
 * cada 30s y dispara el outbound a Vapi.
 */
export async function listarLlamadasProgramadasDue(): Promise<
  LlamadaProgramada[]
> {
  const ahora = new Date().toISOString();
  const { data, error } = await db()
    .from("llamadas_programadas")
    .select("*")
    .eq("estado", "pendiente")
    .lte("programada_para", ahora)
    .order("programada_para", { ascending: true })
    .limit(50);
  if (error) lanzar(error, "listarLlamadasProgramadasDue");
  return (data ?? []) as LlamadaProgramada[];
}

export async function marcarLlamadaProgramadaEjecutada(
  id: string,
  llamadaVapiId: string,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_programadas")
    .update({
      estado: "ejecutada",
      llamada_vapi_id: llamadaVapiId,
      ejecutada_en: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) lanzar(error, "marcarLlamadaProgramadaEjecutada");
}

export async function marcarLlamadaProgramadaFallida(
  id: string,
  razon: string,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_programadas")
    .update({
      estado: "fallida",
      razon_cancelacion: razon.slice(0, 500),
    })
    .eq("id", id);
  if (error) lanzar(error, "marcarLlamadaProgramadaFallida");
}

export async function cancelarLlamadaProgramada(
  id: string,
  razon: string,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_programadas")
    .update({
      estado: "cancelada",
      razon_cancelacion: razon.slice(0, 500),
    })
    .eq("id", id);
  if (error) lanzar(error, "cancelarLlamadaProgramada");
}
