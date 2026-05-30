/**
 * DAO de la conexión a un Supabase EXTERNO por cuenta.
 *
 * Cada cuenta puede conectar el proyecto Supabase de su propio negocio
 * (URL + service_role key). El agente de esa cuenta usa esa conexión para
 * leer/escribir datos reales del negocio al responder.
 *
 * La service_role key se guarda en texto plano (mismo criterio que las
 * credenciales vapi_* del proyecto). NUNCA se devuelve al cliente: las
 * funciones públicas (`obtenerConfigExterna`) omiten la key. Solo
 * `obtenerCredencialesExternas` la expone, y es de uso server-only.
 *
 * Si la migración 38 todavía no se aplicó, las lecturas degradan a
 * "no conectado" y la escritura lanza `ColumnasExternoNoDisponiblesError`
 * para que el endpoint devuelva 503.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./cliente";
import { cache } from "@/lib/cache";
import { cifrar, descifrar } from "@/lib/seguridad/cifrado";

/** Invalida el caché de la cuenta para que el bot tome los cambios al instante. */
function invalidarCacheCuenta(cuentaId: string): void {
  cache.del(`cuenta:${cuentaId}`);
  cache.del("cuentas:activas");
}

/** Máximo de filas que el agente trae por tabla en una consulta. */
const LIMITE_FILAS_CONSULTA = 50;

/** Config pública (sin la key) — segura para mandar al cliente. */
export interface ConfigSupabaseExterno {
  conectado: boolean;
  url: string | null;
  validado_en: string | null;
  tablas: string[];
  /** Si el agente de IA puede consultar esta base al responder. */
  agenteHabilitado: boolean;
  /** Subconjunto de `tablas` que el agente tiene permitido leer. */
  tablasPermitidas: string[];
}

/** Credenciales completas — SOLO para uso server-side (agente). */
export interface CredencialesExternas {
  url: string;
  serviceKey: string;
  tablas: string[];
}

/** Error tipado para que el endpoint devuelva 503 si falta la migración. */
export class ColumnasExternoNoDisponiblesError extends Error {
  code = "COLUMNAS_EXTERNO_NO_DISPONIBLES" as const;
  constructor() {
    super(
      "Las columnas supabase_externo_* todavía no existen. Aplicá la migración 38_supabase_externo.sql.",
    );
  }
}

function esErrorColumnaInexistente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  // 42703 = undefined_column (Postgres), PGRST204 = column not found (PostgREST)
  if (e.code === "42703" || e.code === "PGRST204") return true;
  return (
    typeof e.message === "string" &&
    /column .* does not exist/i.test(e.message)
  );
}

const TIMEOUT_CONEXION_MS = 8000;

/**
 * Normaliza la URL del proyecto Supabase: sin barra final, con esquema.
 * Devuelve null si no es una URL http(s) válida.
 */
function normalizarUrl(url: string): string | null {
  const limpia = url.trim().replace(/\/+$/, "");
  if (!limpia) return null;
  let parsed: URL;
  try {
    parsed = new URL(limpia);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  return limpia;
}

/**
 * Prueba la conexión a un Supabase externo consultando el endpoint raíz
 * de PostgREST (`/rest/v1/`), que devuelve un OpenAPI con todas las
 * tablas accesibles. Sirve a la vez como validación de credenciales y
 * como auto-descubrimiento del esquema.
 *
 * Devuelve `{ ok: true, urlNormalizada, tablas }` o `{ ok: false, error }`.
 */
export async function probarConexionExterna(
  url: string,
  serviceKey: string,
): Promise<
  | { ok: true; urlNormalizada: string; tablas: string[] }
  | { ok: false; error: string }
> {
  const urlNormalizada = normalizarUrl(url);
  if (!urlNormalizada) {
    return { ok: false, error: "La URL no es válida. Ej: https://xxxx.supabase.co" };
  }
  const key = serviceKey.trim();
  if (!key) return { ok: false, error: "Falta la service_role key." };

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_CONEXION_MS);
  try {
    const resp = await fetch(`${urlNormalizada}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controlador.signal,
    });
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { ok: false, error: "Credenciales rechazadas (401/403). Revisá la service_role key." };
      }
      return { ok: false, error: `El servidor respondió ${resp.status}.` };
    }
    const spec = (await resp.json()) as { definitions?: Record<string, unknown> };
    const definiciones = spec.definitions ?? {};
    const tablas = Object.keys(definiciones)
      // PostgREST incluye entradas de RPC con prefijo "(rpc) " — las omitimos.
      .filter((nombre) => !nombre.startsWith("(") && nombre.trim().length > 0)
      .sort();
    return { ok: true, urlNormalizada, tablas };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Tiempo de espera agotado al conectar."
        : err instanceof Error
          ? err.message
          : "Error de red al conectar.";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

/** Guarda la conexión validada en la cuenta. */
export async function guardarConfigExterna(parametros: {
  cuentaId: string;
  url: string;
  serviceKey: string;
  tablas: string[];
}): Promise<void> {
  const { error } = await db()
    .from("cuentas")
    .update({
      supabase_externo_url: parametros.url,
      supabase_externo_service_key: cifrar(parametros.serviceKey),
      supabase_externo_validado_en: new Date().toISOString(),
      supabase_externo_tablas: parametros.tablas,
    })
    .eq("id", parametros.cuentaId);
  if (error) {
    if (esErrorColumnaInexistente(error)) throw new ColumnasExternoNoDisponiblesError();
    throw new Error(`[db:guardarConfigExterna] ${error.message ?? String(error)}`);
  }
  invalidarCacheCuenta(parametros.cuentaId);
}

/** Devuelve la config pública (sin la key). */
export async function obtenerConfigExterna(
  cuentaId: string,
): Promise<ConfigSupabaseExterno> {
  const vacia: ConfigSupabaseExterno = {
    conectado: false,
    url: null,
    validado_en: null,
    tablas: [],
    agenteHabilitado: false,
    tablasPermitidas: [],
  };
  const { data, error } = await db()
    .from("cuentas")
    .select(
      "supabase_externo_url, supabase_externo_validado_en, supabase_externo_tablas, agente_bd_externa_habilitada, agente_tablas_permitidas",
    )
    .eq("id", cuentaId)
    .maybeSingle();
  if (error) {
    if (esErrorColumnaInexistente(error)) return vacia;
    throw new Error(`[db:obtenerConfigExterna] ${error.message ?? String(error)}`);
  }
  if (!data || !data.supabase_externo_url) return vacia;
  return {
    conectado: true,
    url: data.supabase_externo_url as string,
    validado_en: (data.supabase_externo_validado_en as string) ?? null,
    tablas: (data.supabase_externo_tablas as string[]) ?? [],
    agenteHabilitado: (data.agente_bd_externa_habilitada as boolean) ?? false,
    tablasPermitidas: (data.agente_tablas_permitidas as string[]) ?? [],
  };
}

/**
 * Guarda la config del agente: si puede consultar la base externa y qué
 * tablas tiene permitido leer. Filtra `tablasPermitidas` contra las tablas
 * realmente descubiertas para que no se pueda permitir una tabla inexistente.
 */
export async function guardarConfigAgenteExterno(parametros: {
  cuentaId: string;
  habilitado: boolean;
  tablasPermitidas: string[];
}): Promise<void> {
  const { data, error: errLectura } = await db()
    .from("cuentas")
    .select("supabase_externo_tablas")
    .eq("id", parametros.cuentaId)
    .maybeSingle();
  if (errLectura) {
    if (esErrorColumnaInexistente(errLectura)) throw new ColumnasExternoNoDisponiblesError();
    throw new Error(`[db:guardarConfigAgenteExterno] ${errLectura.message ?? String(errLectura)}`);
  }
  const disponibles = new Set((data?.supabase_externo_tablas as string[]) ?? []);
  const tablasFiltradas = parametros.tablasPermitidas.filter((t) => disponibles.has(t));

  const { error } = await db()
    .from("cuentas")
    .update({
      agente_bd_externa_habilitada: parametros.habilitado,
      agente_tablas_permitidas: tablasFiltradas,
    })
    .eq("id", parametros.cuentaId);
  if (error) {
    if (esErrorColumnaInexistente(error)) throw new ColumnasExternoNoDisponiblesError();
    throw new Error(`[db:guardarConfigAgenteExterno] ${error.message ?? String(error)}`);
  }
  invalidarCacheCuenta(parametros.cuentaId);
}

/**
 * Devuelve las credenciales completas (incluida la key). SERVER-ONLY:
 * solo lo usa el agente para abrir el cliente externo. Nunca exponer
 * el resultado al navegador.
 */
export async function obtenerCredencialesExternas(
  cuentaId: string,
): Promise<CredencialesExternas | null> {
  const { data, error } = await db()
    .from("cuentas")
    .select(
      "supabase_externo_url, supabase_externo_service_key, supabase_externo_tablas",
    )
    .eq("id", cuentaId)
    .maybeSingle();
  if (error) {
    if (esErrorColumnaInexistente(error)) return null;
    throw new Error(`[db:obtenerCredencialesExternas] ${error.message ?? String(error)}`);
  }
  if (!data || !data.supabase_externo_url || !data.supabase_externo_service_key) {
    return null;
  }
  return {
    url: data.supabase_externo_url as string,
    serviceKey: descifrar(data.supabase_externo_service_key as string),
    tablas: (data.supabase_externo_tablas as string[]) ?? [],
  };
}

/**
 * Lee filas de las tablas externas que el agente solicitó. SERVER-ONLY.
 *
 * Seguridad:
 *   - Deny-by-default: solo se consultan tablas en `agente_tablas_permitidas`.
 *   - Solo lectura (select). Nunca escribe.
 *   - Filtros de igualdad para acotar la consulta a los datos del PROPIO
 *     cliente (ej: email/teléfono). Con filtros el tope baja a 10 filas; sin
 *     filtros (catálogo público) usa el tope general.
 *   - Si una columna de filtro no existe en una tabla, esa tabla se OMITE
 *     (no se devuelve completa) — evita fugas de datos de otros clientes.
 *
 * Devuelve un mapa { tabla: filas[] }. Si la cuenta no tiene la integración
 * habilitada o no hay credenciales, devuelve {} (el agente responde sin datos).
 */
export async function consultarTablasExternas(
  cuentaId: string,
  tablasSolicitadas: string[],
  filtros: { columna: string; valor: string; valores?: string[] }[] = [],
): Promise<Record<string, Record<string, unknown>[]>> {
  const config = await obtenerConfigExterna(cuentaId);
  if (!config.conectado || !config.agenteHabilitado) return {};
  const permitidas = new Set(config.tablasPermitidas);

  const objetivo = tablasSolicitadas.filter((t) => permitidas.has(t));
  if (objetivo.length === 0) return {};

  const creds = await obtenerCredencialesExternas(cuentaId);
  if (!creds) return {};

  const cliente = createClient(creds.url, creds.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const filtrosValidos = filtros.filter(
    (f) =>
      f &&
      typeof f.columna === "string" &&
      f.columna.trim() !== "" &&
      ((f.valor != null && String(f.valor) !== "") ||
        (Array.isArray(f.valores) && f.valores.length > 0)),
  );
  const tope = filtrosValidos.length > 0 ? 30 : LIMITE_FILAS_CONSULTA;

  const resultado: Record<string, Record<string, unknown>[]> = {};
  for (const tabla of objetivo) {
    let q = cliente.from(tabla).select("*").limit(tope);
    for (const f of filtrosValidos) {
      if (Array.isArray(f.valores) && f.valores.length > 0) {
        q = q.in(f.columna, f.valores) as typeof q;
      } else {
        q = q.eq(f.columna, f.valor) as typeof q;
      }
    }
    const { data, error } = await q;
    if (!error && data) {
      resultado[tabla] = data as Record<string, unknown>[];
    }
    // error (ej: columna de filtro inexistente) → omitimos la tabla. No
    // devolvemos la tabla entera para no exponer datos de otros clientes.
  }
  return resultado;
}

// Cache de columnas por cuenta (el esquema cambia poco). TTL 1h.
const cacheColumnas = new Map<string, { cols: Record<string, string[]>; expira: number }>();

/**
 * Devuelve { tabla: [columnas] } de las tablas permitidas del agente, leyendo
 * el OpenAPI de PostgREST (`/rest/v1/`). Genérico para CUALQUIER negocio: el
 * agente recibe las tablas y columnas REALES de su Supabase y decide solo qué
 * consultar para vender, sin nombres hardcodeados. Cacheado 1h.
 */
export async function obtenerColumnasPermitidas(
  cuentaId: string,
): Promise<Record<string, string[]>> {
  const cached = cacheColumnas.get(cuentaId);
  if (cached && cached.expira > Date.now()) return cached.cols;

  const config = await obtenerConfigExterna(cuentaId);
  if (!config.conectado || !config.agenteHabilitado || config.tablasPermitidas.length === 0) {
    return {};
  }
  const creds = await obtenerCredencialesExternas(cuentaId);
  if (!creds) return {};

  const result: Record<string, string[]> = {};
  try {
    const resp = await fetch(`${creds.url}/rest/v1/`, {
      headers: { apikey: creds.serviceKey, Authorization: `Bearer ${creds.serviceKey}` },
    });
    if (resp.ok) {
      const spec = (await resp.json()) as {
        definitions?: Record<string, { properties?: Record<string, unknown> }>;
      };
      const defs = spec.definitions ?? {};
      for (const t of config.tablasPermitidas) {
        const props = defs[t]?.properties;
        if (props) result[t] = Object.keys(props);
      }
    }
  } catch {
    /* si falla, devolvemos lo que haya (o vacío) — el agente igual puede consultar */
  }
  cacheColumnas.set(cuentaId, { cols: result, expira: Date.now() + 60 * 60 * 1000 });
  return result;
}

// ============================================================
// ESCRITURA POR EL DUEÑO (operador privado) — SERVER-ONLY
//
// El dueño, escribiendo desde su número (telefono_operador_privado),
// tiene acceso TOTAL (crear/leer/editar/borrar) a TODAS las tablas
// descubiertas de su propio Supabase — independiente del gate del agente
// (agente_bd_externa_habilitada / agente_tablas_permitidas, que solo
// limitan al agente de ventas hacia los clientes).
//
// Seguridad:
//   - Solo se opera sobre tablas en supabase_externo_tablas (descubiertas).
//   - Filtros estructurados por igualdad (.eq) — nunca SQL crudo.
//   - update/delete exigen al menos un filtro (evita afectar toda la tabla).
//   - La confirmación previa a borrar/editar-masivo la maneja el operador
//     (manejadorOperadorPrivado) usando contarFilasExternas como preview.
// ============================================================

/** Resultado uniforme de una operación de escritura/lectura externa. */
export interface ResultadoOperacionExterna {
  ok: boolean;
  mensaje: string;
  filas?: Record<string, unknown>[];
  afectadas?: number;
}

function tablaNoDisponible(tabla: string, tablas: string[]): string {
  return `La tabla "${tabla}" no existe en tu Supabase. Tablas disponibles: ${tablas.join(", ") || "(ninguna)"}.`;
}

/** Abre un cliente al Supabase externo y devuelve las tablas descubiertas. */
async function abrirClienteExterno(
  cuentaId: string,
): Promise<{ cliente: SupabaseClient; tablas: string[] } | null> {
  const creds = await obtenerCredencialesExternas(cuentaId);
  if (!creds) return null;
  const cliente = createClient(creds.url, creds.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { cliente, tablas: creds.tablas };
}

/** Aplica filtros de igualdad sobre un query builder de PostgREST. */
function aplicarFiltrosEq<T>(query: T, filtros: Record<string, unknown>): T {
  let q = query as { eq(col: string, val: unknown): T };
  for (const [col, val] of Object.entries(filtros)) {
    q = q.eq(col, val) as unknown as { eq(col: string, val: unknown): T };
  }
  return q as unknown as T;
}

/** Lista las tablas descubiertas del Supabase externo del dueño. */
export async function listarTablasExternas(cuentaId: string): Promise<string[]> {
  const config = await obtenerConfigExterna(cuentaId);
  return config.conectado ? config.tablas : [];
}

/** Lee filas de una tabla externa (acceso total del dueño). */
export async function leerFilasExternas(
  cuentaId: string,
  tabla: string,
  filtros: Record<string, unknown> = {},
  limite = LIMITE_FILAS_CONSULTA,
): Promise<ResultadoOperacionExterna> {
  const conn = await abrirClienteExterno(cuentaId);
  if (!conn) return { ok: false, mensaje: "No hay Supabase externo conectado." };
  if (!conn.tablas.includes(tabla)) {
    return { ok: false, mensaje: tablaNoDisponible(tabla, conn.tablas) };
  }
  const tope = Math.max(1, Math.min(LIMITE_FILAS_CONSULTA, limite || LIMITE_FILAS_CONSULTA));
  const base = conn.cliente.from(tabla).select("*").limit(tope);
  const { data, error } = await aplicarFiltrosEq(base, filtros);
  if (error) return { ok: false, mensaje: `Error leyendo ${tabla}: ${error.message}` };
  return {
    ok: true,
    mensaje: `${data?.length ?? 0} fila(s) en "${tabla}".`,
    filas: (data ?? []) as Record<string, unknown>[],
  };
}

/** Cuenta cuántas filas coinciden con los filtros (preview de update/delete). */
export async function contarFilasExternas(
  cuentaId: string,
  tabla: string,
  filtros: Record<string, unknown>,
): Promise<{ ok: boolean; count?: number; mensaje?: string }> {
  const conn = await abrirClienteExterno(cuentaId);
  if (!conn) return { ok: false, mensaje: "No hay Supabase externo conectado." };
  if (!conn.tablas.includes(tabla)) {
    return { ok: false, mensaje: tablaNoDisponible(tabla, conn.tablas) };
  }
  const base = conn.cliente.from(tabla).select("*", { count: "exact", head: true });
  const { count, error } = await aplicarFiltrosEq(base, filtros);
  if (error) return { ok: false, mensaje: error.message };
  return { ok: true, count: count ?? 0 };
}

/** Crea una fila en una tabla externa. */
export async function crearFilaExterna(
  cuentaId: string,
  tabla: string,
  valores: Record<string, unknown>,
): Promise<ResultadoOperacionExterna> {
  const conn = await abrirClienteExterno(cuentaId);
  if (!conn) return { ok: false, mensaje: "No hay Supabase externo conectado." };
  if (!conn.tablas.includes(tabla)) {
    return { ok: false, mensaje: tablaNoDisponible(tabla, conn.tablas) };
  }
  const { data, error } = await conn.cliente.from(tabla).insert(valores).select();
  if (error) return { ok: false, mensaje: `Error creando en ${tabla}: ${error.message}` };
  return {
    ok: true,
    mensaje: `Fila creada en "${tabla}".`,
    filas: (data ?? []) as Record<string, unknown>[],
  };
}

/** Actualiza filas que coinciden con los filtros. Exige al menos un filtro. */
export async function actualizarFilasExternas(
  cuentaId: string,
  tabla: string,
  filtros: Record<string, unknown>,
  valores: Record<string, unknown>,
): Promise<ResultadoOperacionExterna> {
  if (Object.keys(filtros).length === 0) {
    return { ok: false, mensaje: "Necesito al menos un filtro para actualizar (evita modificar toda la tabla)." };
  }
  const conn = await abrirClienteExterno(cuentaId);
  if (!conn) return { ok: false, mensaje: "No hay Supabase externo conectado." };
  if (!conn.tablas.includes(tabla)) {
    return { ok: false, mensaje: tablaNoDisponible(tabla, conn.tablas) };
  }
  const base = conn.cliente.from(tabla).update(valores);
  const { data, error } = await aplicarFiltrosEq(base, filtros).select();
  if (error) return { ok: false, mensaje: `Error actualizando ${tabla}: ${error.message}` };
  return {
    ok: true,
    mensaje: `${data?.length ?? 0} fila(s) actualizada(s) en "${tabla}".`,
    afectadas: data?.length ?? 0,
    filas: (data ?? []) as Record<string, unknown>[],
  };
}

/** Elimina filas que coinciden con los filtros. Exige al menos un filtro. */
export async function eliminarFilasExternas(
  cuentaId: string,
  tabla: string,
  filtros: Record<string, unknown>,
): Promise<ResultadoOperacionExterna> {
  if (Object.keys(filtros).length === 0) {
    return { ok: false, mensaje: "Necesito al menos un filtro para borrar (evita vaciar toda la tabla)." };
  }
  const conn = await abrirClienteExterno(cuentaId);
  if (!conn) return { ok: false, mensaje: "No hay Supabase externo conectado." };
  if (!conn.tablas.includes(tabla)) {
    return { ok: false, mensaje: tablaNoDisponible(tabla, conn.tablas) };
  }
  const base = conn.cliente.from(tabla).delete();
  const { data, error } = await aplicarFiltrosEq(base, filtros).select();
  if (error) return { ok: false, mensaje: `Error borrando en ${tabla}: ${error.message}` };
  return {
    ok: true,
    mensaje: `${data?.length ?? 0} fila(s) eliminada(s) de "${tabla}".`,
    afectadas: data?.length ?? 0,
  };
}

/** Borra la conexión externa de la cuenta. */
export async function borrarConfigExterna(cuentaId: string): Promise<void> {
  const { error } = await db()
    .from("cuentas")
    .update({
      supabase_externo_url: null,
      supabase_externo_service_key: null,
      supabase_externo_validado_en: null,
      supabase_externo_tablas: [],
    })
    .eq("id", cuentaId);
  if (error) {
    if (esErrorColumnaInexistente(error)) throw new ColumnasExternoNoDisponiblesError();
    throw new Error(`[db:borrarConfigExterna] ${error.message ?? String(error)}`);
  }
  invalidarCacheCuenta(cuentaId);
}
