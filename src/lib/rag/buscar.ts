/**
 * Busqueda semántica del conocimiento de una cuenta. Toma el último
 * mensaje del cliente (o cualquier query), lo embedea y devuelve los
 * top-k chunks mas similares.
 *
 * Tiene fallback robusto: si OpenAI o pgvector fallan, devuelve []
 * y el caller (construirPromptSistema) cae al modo dump tradicional.
 */
import {
  buscarChunksSimilares,
  type ResultadoBusquedaChunk,
} from "../baseDatos";
import { generarEmbedding } from "./embeddings";

const K_DEFAULT = 5;
const THRESHOLD_DEFAULT = 0.4;

/**
 * Busca chunks de conocimiento relevantes para `query` en la cuenta
 * dada. Devuelve [] si no hay matches buenos o si algo falla.
 */
export async function buscarConocimientoRelevante(
  cuentaId: string,
  query: string,
  opciones?: { k?: number; threshold?: number },
): Promise<ResultadoBusquedaChunk[]> {
  const limpio = query.trim();
  if (!limpio || limpio.length < 3) return [];

  try {
    const embedding = await generarEmbedding(limpio);
    return await buscarChunksSimilares(
      cuentaId,
      embedding,
      opciones?.k ?? K_DEFAULT,
      opciones?.threshold ?? THRESHOLD_DEFAULT,
    );
  } catch (err) {
    console.warn("[rag:buscar] fallo, cayendo a dump:", err);
    return [];
  }
}
