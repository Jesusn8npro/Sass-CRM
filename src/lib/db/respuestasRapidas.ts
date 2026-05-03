import { db, lanzar } from "./cliente";
import type { RespuestaRapida } from "./tipos";

export async function listarRespuestasRapidas(
  cuentaId: string,
): Promise<RespuestaRapida[]> {
  const { data, error } = await db()
    .from("respuestas_rapidas")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarRespuestasRapidas");
  return (data ?? []) as RespuestaRapida[];
}

export async function crearRespuestaRapida(
  cuentaId: string,
  atajo: string,
  texto: string,
): Promise<RespuestaRapida> {
  const { data: max } = await db()
    .from("respuestas_rapidas")
    .select("orden")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = ((max as { orden: number } | null)?.orden ?? 0) + 1;
  const { data, error } = await db()
    .from("respuestas_rapidas")
    .insert({ cuenta_id: cuentaId, atajo, texto, orden })
    .select()
    .single();
  if (error) lanzar(error, "crearRespuestaRapida");
  return data as RespuestaRapida;
}

export async function actualizarRespuestaRapida(
  id: string,
  cambios: Partial<{ atajo: string; texto: string; orden: number }>,
): Promise<RespuestaRapida | null> {
  const { data, error } = await db()
    .from("respuestas_rapidas")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarRespuestaRapida");
  return data as RespuestaRapida;
}

export async function borrarRespuestaRapida(id: string): Promise<void> {
  const { error } = await db()
    .from("respuestas_rapidas")
    .delete()
    .eq("id", id);
  if (error) lanzar(error, "borrarRespuestaRapida");
}
