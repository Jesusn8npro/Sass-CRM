import { db, lanzar } from "./cliente";
import type { EstadoLlamada, LlamadaVapi } from "./tipos";

export async function crearLlamadaVapi(
  cuentaId: string,
  conversacionId: string | null,
  vapiCallId: string,
  telefono: string,
  direccion: "saliente" | "entrante" = "saliente",
): Promise<LlamadaVapi> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .insert({
      cuenta_id: cuentaId,
      conversacion_id: conversacionId,
      vapi_call_id: vapiCallId,
      telefono,
      direccion,
      estado: "iniciando",
    })
    .select()
    .single();
  if (error) lanzar(error, "crearLlamadaVapi");
  return data as LlamadaVapi;
}

export async function obtenerLlamadaPorId(
  id: string,
): Promise<LlamadaVapi | null> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLlamadaPorId");
  return (data as LlamadaVapi) ?? null;
}

export async function obtenerLlamadaPorCallId(
  vapiCallId: string,
): Promise<LlamadaVapi | null> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("vapi_call_id", vapiCallId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLlamadaPorCallId");
  return (data as LlamadaVapi) ?? null;
}

export async function listarLlamadasDeCuenta(
  cuentaId: string,
  limite = 100,
): Promise<LlamadaVapi[]> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("iniciada_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarLlamadasDeCuenta");
  return (data ?? []) as LlamadaVapi[];
}

export async function listarLlamadasDeConversacion(
  conversacionId: string,
): Promise<LlamadaVapi[]> {
  const { data, error } = await db()
    .from("llamadas_vapi")
    .select("*")
    .eq("conversacion_id", conversacionId)
    .order("iniciada_en", { ascending: false });
  if (error) lanzar(error, "listarLlamadasDeConversacion");
  return (data ?? []) as LlamadaVapi[];
}

export async function actualizarLlamadaPorCallId(
  vapiCallId: string,
  cambios: Partial<{
    estado: EstadoLlamada;
    transcripcion: string;
    resumen: string;
    audio_url: string;
    duracion_seg: number;
    costo_usd: number;
    terminada_en: string;
  }>,
): Promise<void> {
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (v !== undefined) limpio[k] = v;
  }
  if (Object.keys(limpio).length === 0) return;
  const { error } = await db()
    .from("llamadas_vapi")
    .update(limpio)
    .eq("vapi_call_id", vapiCallId);
  if (error) lanzar(error, "actualizarLlamadaPorCallId");
}

export async function borrarLlamada(id: string): Promise<void> {
  const { error } = await db().from("llamadas_vapi").delete().eq("id", id);
  if (error) lanzar(error, "borrarLlamada");
}
