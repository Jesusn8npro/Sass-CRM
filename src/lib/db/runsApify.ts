/**
 * Acceso a la tabla runs_apify. Cada fila es un job lanzado a la
 * plataforma Apify desde el panel del usuario.
 */
import { db, lanzar } from "./cliente";

export type EstadoRunApify =
  | "corriendo"
  | "completado"
  | "fallido"
  | "abortado";

export interface RunApify {
  id: string;
  cuenta_id: string;
  actor_id: string;
  input: Record<string, unknown>;
  apify_run_id: string | null;
  apify_dataset_id: string | null;
  estado: EstadoRunApify;
  items_count: number;
  costo_creditos: number;
  costo_usd: number | null;
  error: string | null;
  creado_en: string;
  completado_en: string | null;
}

export async function crearRunApify(input: {
  cuenta_id: string;
  actor_id: string;
  input: Record<string, unknown>;
  costo_creditos: number;
}): Promise<RunApify> {
  const { data, error } = await db()
    .from("runs_apify")
    .insert({
      cuenta_id: input.cuenta_id,
      actor_id: input.actor_id,
      input: input.input,
      costo_creditos: input.costo_creditos,
      estado: "corriendo",
    })
    .select()
    .single();
  if (error) lanzar(error, "crearRunApify");
  return data as RunApify;
}

export async function asociarApifyRunId(
  id: string,
  apifyRunId: string,
): Promise<void> {
  const { error } = await db()
    .from("runs_apify")
    .update({ apify_run_id: apifyRunId })
    .eq("id", id);
  if (error) lanzar(error, "asociarApifyRunId");
}

export async function obtenerRunApifyPorApifyId(
  apifyRunId: string,
): Promise<RunApify | null> {
  const { data, error } = await db()
    .from("runs_apify")
    .select("*")
    .eq("apify_run_id", apifyRunId)
    .maybeSingle();
  if (error) lanzar(error, "obtenerRunApifyPorApifyId");
  return (data as RunApify) ?? null;
}

export async function actualizarRunApify(
  id: string,
  cambios: Partial<Pick<
    RunApify,
    | "estado"
    | "apify_dataset_id"
    | "items_count"
    | "costo_usd"
    | "error"
    | "completado_en"
  >>,
): Promise<void> {
  const { error } = await db()
    .from("runs_apify")
    .update(cambios)
    .eq("id", id);
  if (error) lanzar(error, "actualizarRunApify");
}

export async function listarRunsApify(
  cuentaId: string,
  limite = 30,
): Promise<RunApify[]> {
  const { data, error } = await db()
    .from("runs_apify")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarRunsApify");
  return (data ?? []) as RunApify[];
}

export async function obtenerRunApify(
  id: string,
): Promise<RunApify | null> {
  const { data, error } = await db()
    .from("runs_apify")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerRunApify");
  return (data as RunApify) ?? null;
}
