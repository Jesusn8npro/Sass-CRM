/**
 * Busqueda semántica del conocimiento de una cuenta. Pre-check rápido:
 * si la cuenta NO tiene chunks indexados, salta el embedding (que es
 * la operación cara). Cache de 60s para no consultar el conteo en
 * cada mensaje. Timeout de 3s para que un OpenAI lento no bloquee
 * la respuesta del bot.
 */
import {
  buscarChunksSimilares,
  contarChunksDeCuenta,
  type ResultadoBusquedaChunk,
} from "../baseDatos";
import { generarEmbedding } from "./embeddings";

const K_DEFAULT = 5;
const THRESHOLD_DEFAULT = 0.4;
const TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 60_000;

interface CacheChunks {
  hayChunks: boolean;
  expira: number;
}
const cacheTieneChunks = new Map<string, CacheChunks>();

async function tieneChunksIndexados(cuentaId: string): Promise<boolean> {
  const ahora = Date.now();
  const cached = cacheTieneChunks.get(cuentaId);
  if (cached && cached.expira > ahora) return cached.hayChunks;
  try {
    const count = await contarChunksDeCuenta(cuentaId);
    const hay = count > 0;
    cacheTieneChunks.set(cuentaId, {
      hayChunks: hay,
      expira: ahora + CACHE_TTL_MS,
    });
    return hay;
  } catch {
    // Si falla el conteo (ej. migración 06 no aplicada), asumimos
    // que NO hay chunks y caemos a dump. Cache también el negativo
    // para no spammear errores cada mensaje.
    cacheTieneChunks.set(cuentaId, {
      hayChunks: false,
      expira: ahora + CACHE_TTL_MS,
    });
    return false;
  }
}

/**
 * Busca chunks de conocimiento relevantes para `query` en la cuenta
 * dada. Devuelve [] si:
 *  - no hay chunks indexados (skip rápido sin tocar OpenAI)
 *  - el query es muy corto
 *  - el embedding o la búsqueda fallan
 *  - timeout de 3s
 */
export async function buscarConocimientoRelevante(
  cuentaId: string,
  query: string,
  opciones?: { k?: number; threshold?: number },
): Promise<ResultadoBusquedaChunk[]> {
  const limpio = query.trim();
  if (!limpio || limpio.length < 3) return [];

  // Fast-path: si la cuenta no tiene chunks, no llamamos a OpenAI ni
  // a la RPC. Ahorra 200ms-5s por mensaje y elimina punto de falla.
  if (!(await tieneChunksIndexados(cuentaId))) return [];

  try {
    return await Promise.race([
      ejecutarBusqueda(cuentaId, limpio, opciones),
      timeout(TIMEOUT_MS),
    ]);
  } catch (err) {
    console.warn("[rag:buscar] fallo o timeout, cayendo a dump:", err);
    return [];
  }
}

async function ejecutarBusqueda(
  cuentaId: string,
  query: string,
  opciones?: { k?: number; threshold?: number },
): Promise<ResultadoBusquedaChunk[]> {
  const embedding = await generarEmbedding(query);
  return buscarChunksSimilares(
    cuentaId,
    embedding,
    opciones?.k ?? K_DEFAULT,
    opciones?.threshold ?? THRESHOLD_DEFAULT,
  );
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`RAG timeout ${ms}ms`)), ms),
  );
}

/**
 * Invalida el cache de "tiene chunks" — útil después de indexar la
 * primera entrada de una cuenta para que la próxima búsqueda use RAG
 * en vez de seguir cacheada como "sin chunks" hasta el TTL.
 */
export function invalidarCacheChunks(cuentaId: string): void {
  cacheTieneChunks.delete(cuentaId);
}
