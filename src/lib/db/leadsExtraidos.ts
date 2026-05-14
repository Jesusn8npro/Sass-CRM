/**
 * Bandeja de leads extraidos via Apify. NO crea conversaciones —
 * solo guarda. El user decide cuáles importar via boton dedicado.
 */
import { db, lanzar } from "./cliente";

export type EstadoProspeccion =
  | "nuevo"
  | "en_cola"
  | "llamado"
  | "emaileado"
  | "completado"
  | "no_contactable"
  | "fallido";

/** @deprecated Usar EstadoProspeccion */
export type EstadoOutreach = EstadoProspeccion;

export type MetodoContacto = "llamada" | "email" | "ninguno";

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
  fuente_url: string | null;
  raw: Record<string, unknown>;
  importado: boolean;
  conversacion_id: string | null;
  /** Estado en el pipeline de prospección automática (migration 22/23). */
  estado_prospeccion: EstadoProspeccion;
  metodo_contacto: MetodoContacto | null;
  intentos_outreach: number;
  prospeccion_actualizado_en: string;
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
  fuente_url?: string | null;
  raw: Record<string, unknown>;
}

export async function insertarLeadsExtraidos(
  filas: InputLeadExtraido[],
): Promise<number> {
  if (filas.length === 0) return 0;

  // Deduplicación: salteamos leads cuyo teléfono O nombre ya existe
  // en la cuenta. Igual que el video — evita llamar dos veces al mismo negocio.
  const cuentaId = filas[0]!.cuenta_id;
  const telefonos = filas.map((f) => f.telefono).filter(Boolean) as string[];
  const nombres = filas.map((f) => f.nombre.trim().toLowerCase());

  const { data: existentes } = await db()
    .from("leads_extraidos")
    .select("telefono, nombre")
    .eq("cuenta_id", cuentaId);

  const telExistentes = new Set(
    (existentes ?? []).map((e: { telefono: string | null }) => e.telefono).filter(Boolean),
  );
  const nomExistentes = new Set(
    (existentes ?? []).map((e: { nombre: string }) => e.nombre.trim().toLowerCase()),
  );

  const nuevas = filas.filter((f) => {
    if (f.telefono && telExistentes.has(f.telefono)) return false;
    if (nomExistentes.has(f.nombre.trim().toLowerCase())) return false;
    return true;
  });

  if (nuevas.length === 0) return 0;

  const { error, count } = await db()
    .from("leads_extraidos")
    .insert(nuevas, { count: "exact" });
  if (error) lanzar(error, "insertarLeadsExtraidos");
  return count ?? nuevas.length;
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

/**
 * Incrementa el contador de intentos y decide si reintentar o descartar.
 * - intentos < 3 → resetea a 'nuevo' para que el orquestador lo pique de nuevo
 * - intentos >= 3 → marca como 'no_contactable' (se agotaron los reintentos)
 */
export async function registrarFalloProspeccion(
  id: string,
  intentosActuales: number,
): Promise<void> {
  const nuevosIntentos = intentosActuales + 1;
  const nuevoEstado: EstadoProspeccion =
    nuevosIntentos >= 3 ? "no_contactable" : "nuevo";

  const { error } = await db()
    .from("leads_extraidos")
    .update({
      intentos_outreach: nuevosIntentos,
      estado_prospeccion: nuevoEstado,
    })
    .eq("id", id);
  if (error) lanzar(error, "registrarFalloProspeccion");
}

/** Actualiza el estado del pipeline de prospección de un lead. */
export async function actualizarEstadoProspeccion(
  id: string,
  estado: EstadoProspeccion,
  metodoContacto?: MetodoContacto,
): Promise<void> {
  const campos: Record<string, unknown> = { estado_prospeccion: estado };
  if (metodoContacto) campos.metodo_contacto = metodoContacto;
  const { error } = await db()
    .from("leads_extraidos")
    .update(campos)
    .eq("id", id);
  if (error) lanzar(error, "actualizarEstadoProspeccion");
}

/** @deprecated Usar actualizarEstadoProspeccion */
export const actualizarEstadoOutreach = actualizarEstadoProspeccion;

/**
 * Devuelve leads de una cuenta con estado_prospeccion = 'nuevo'.
 * El orquestador los procesa cada 5 minutos.
 */
export async function listarLeadsNuevosParaProspeccion(
  cuentaId: string,
  limite = 20,
): Promise<LeadExtraido[]> {
  const { data, error } = await db()
    .from("leads_extraidos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("estado_prospeccion", "nuevo")
    .order("creado_en", { ascending: true })
    .limit(limite);
  if (error) lanzar(error, "listarLeadsNuevosParaProspeccion");
  return (data ?? []) as LeadExtraido[];
}

/** @deprecated Usar listarLeadsNuevosParaProspeccion */
export const listarLeadsNuevosParaOutreach = listarLeadsNuevosParaProspeccion;

/** Contadores del pipeline de prospección para el dashboard. */
export async function contarLeadsPorEstadoProspeccion(
  cuentaId: string,
): Promise<Record<string, number>> {
  const { data, error } = await db()
    .from("leads_extraidos")
    .select("estado_prospeccion")
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "contarLeadsPorEstadoProspeccion");

  const conteos: Record<string, number> = {
    nuevo: 0, en_cola: 0, llamado: 0, emaileado: 0,
    completado: 0, no_contactable: 0, fallido: 0,
  };
  for (const row of (data ?? []) as { estado_prospeccion: string }[]) {
    const e = row.estado_prospeccion;
    if (e in conteos) conteos[e]!++;
  }
  return conteos;
}

/** Lista leads con estado distinto de 'nuevo' para el dashboard de prospección. */
export async function listarLeadsProspeccion(
  cuentaId: string,
  limite = 100,
): Promise<LeadExtraido[]> {
  const { data, error } = await db()
    .from("leads_extraidos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("prospeccion_actualizado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarLeadsProspeccion");
  return (data ?? []) as LeadExtraido[];
}

/**
 * Lista todos los leads extraidos de una cuenta para export CSV.
 * Tope `limite` para no fundir el server con cuentas gigantes.
 */
export async function listarLeadsParaExport(
  cuentaId: string,
  limite: number,
): Promise<LeadExtraido[]> {
  const { data, error } = await db()
    .from("leads_extraidos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) lanzar(error, "listarLeadsParaExport");
  return (data ?? []) as LeadExtraido[];
}
