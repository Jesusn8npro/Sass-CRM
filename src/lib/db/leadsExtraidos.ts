/**
 * Bandeja de leads extraidos via Apify. NO crea conversaciones —
 * solo guarda. El user decide cuáles importar via boton dedicado.
 */
import { db, lanzar } from "./cliente";

export interface LeadExtraido {
  id: string;
  cuenta_id: string;
  run_apify_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  sitio_web: string | null;
  categoria: string | null;
  raw: Record<string, unknown>;
  importado: boolean;
  conversacion_id: string | null;
  creado_en: string;
}

export interface InputLeadExtraido {
  cuenta_id: string;
  run_apify_id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  sitio_web: string | null;
  categoria: string | null;
  raw: Record<string, unknown>;
}

export async function insertarLeadsExtraidos(
  filas: InputLeadExtraido[],
): Promise<number> {
  if (filas.length === 0) return 0;
  const { error, count } = await db()
    .from("leads_extraidos")
    .insert(filas, { count: "exact" });
  if (error) lanzar(error, "insertarLeadsExtraidos");
  return count ?? filas.length;
}

export async function listarLeadsDeRun(
  runApifyId: string,
): Promise<LeadExtraido[]> {
  const { data, error } = await db()
    .from("leads_extraidos")
    .select("*")
    .eq("run_apify_id", runApifyId)
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarLeadsDeRun");
  return (data ?? []) as LeadExtraido[];
}

export async function obtenerLead(
  id: string,
): Promise<LeadExtraido | null> {
  const { data, error } = await db()
    .from("leads_extraidos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerLead");
  return (data as LeadExtraido) ?? null;
}

export async function marcarLeadImportado(
  id: string,
  conversacionId: string,
): Promise<void> {
  const { error } = await db()
    .from("leads_extraidos")
    .update({ importado: true, conversacion_id: conversacionId })
    .eq("id", id);
  if (error) lanzar(error, "marcarLeadImportado");
}
