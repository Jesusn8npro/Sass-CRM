import { db, lanzar } from "./cliente";

export interface LlamadaLanding {
  id: string;
  vapi_call_id: string;
  ip: string | null;
  transcripcion: string | null;
  resumen: string | null;
  duracion_seg: number | null;
  costo_usd: number | null;
  datos_negocio: Record<string, unknown> | null;
  creado_en: string;
  terminada_en: string | null;
}

export async function registrarLlamadaLanding(
  vapiCallId: string,
  ip?: string,
): Promise<LlamadaLanding> {
  const { data, error } = await db()
    .from("llamadas_landing")
    .insert({ vapi_call_id: vapiCallId, ip: ip ?? null })
    .select()
    .single();
  if (error) lanzar(error, "registrarLlamadaLanding");
  return data as LlamadaLanding;
}

export async function actualizarLlamadaLanding(
  vapiCallId: string,
  campos: Partial<Pick<LlamadaLanding, "transcripcion" | "resumen" | "duracion_seg" | "costo_usd" | "datos_negocio" | "terminada_en">>,
): Promise<void> {
  const { error } = await db()
    .from("llamadas_landing")
    .update(campos)
    .eq("vapi_call_id", vapiCallId);
  if (error) lanzar(error, "actualizarLlamadaLanding");
}

export async function obtenerLlamadaLandingPorCallId(
  vapiCallId: string,
): Promise<LlamadaLanding | null> {
  const { data, error } = await db()
    .from("llamadas_landing")
    .select("*")
    .eq("vapi_call_id", vapiCallId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLlamadaLandingPorCallId");
  return (data as LlamadaLanding) ?? null;
}
