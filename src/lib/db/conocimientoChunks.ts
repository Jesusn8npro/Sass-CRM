/**
 * CRUD de chunks de conocimiento + funcion de busqueda vectorial.
 */
import { db, lanzar } from "./cliente";

export interface ChunkConocimiento {
  id: string;
  conocimiento_id: string;
  cuenta_id: string;
  orden: number;
  contenido: string;
  embedding: number[] | null;
  creado_en: string;
}

export interface ResultadoBusquedaChunk {
  id: string;
  conocimiento_id: string;
  contenido: string;
  similitud: number;
  titulo: string;
  categoria: string;
}

export async function borrarChunksDeEntrada(
  conocimientoId: string,
): Promise<void> {
  const { error } = await db()
    .from("conocimiento_chunks")
    .delete()
    .eq("conocimiento_id", conocimientoId);
  if (error) lanzar(error, "borrarChunksDeEntrada");
}

export async function insertarChunks(
  filas: Array<{
    conocimiento_id: string;
    cuenta_id: string;
    orden: number;
    contenido: string;
    embedding: number[];
  }>,
): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await db()
    .from("conocimiento_chunks")
    .insert(filas);
  if (error) lanzar(error, "insertarChunks");
}

/**
 * Busca los k chunks mas similares al query embedding dentro de la
 * cuenta. Usa la funcion SQL buscar_chunks_similares (cosine).
 */
export async function buscarChunksSimilares(
  cuentaId: string,
  queryEmbedding: number[],
  k = 5,
  threshold = 0.5,
): Promise<ResultadoBusquedaChunk[]> {
  const { data, error } = await db().rpc("buscar_chunks_similares", {
    p_query_embedding: queryEmbedding as unknown as string,
    p_cuenta_id: cuentaId,
    p_k: k,
    p_threshold: threshold,
  });
  if (error) lanzar(error, "buscarChunksSimilares");
  return (data ?? []) as ResultadoBusquedaChunk[];
}

/**
 * Cuenta cuántos chunks existen para una cuenta — útil para detectar
 * si la cuenta tiene RAG activado o sigue en modo dump.
 */
export async function contarChunksDeCuenta(
  cuentaId: string,
): Promise<number> {
  const { count, error } = await db()
    .from("conocimiento_chunks")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_id", cuentaId);
  if (error) lanzar(error, "contarChunksDeCuenta");
  return count ?? 0;
}
