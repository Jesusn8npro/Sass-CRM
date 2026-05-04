/**
 * Pipeline de indexacion: dado una entrada de conocimiento, la
 * chunkifica, genera embeddings y persiste los chunks. Reemplaza
 * los chunks viejos de esa entrada (idempotente — re-ejecutar es
 * seguro).
 *
 * Costo aprox: 1 entrada de ~5K chars = 3 chunks = 3K tokens
 * embedding = $0.00006. Escalable.
 */
import {
  borrarChunksDeEntrada,
  insertarChunks,
} from "../baseDatos";
import { chunkear } from "./chunker";
import { generarEmbeddingsBatch } from "./embeddings";

export interface ResumenIndexacion {
  conocimiento_id: string;
  chunks_generados: number;
  bytes_indexados: number;
  error?: string;
}

/**
 * Re-indexa una entrada (borra chunks viejos + genera nuevos).
 * Si el contenido es vacio o muy corto, NO genera chunks pero
 * tampoco lanza error (la entrada simplemente no participa en RAG).
 */
export async function indexarEntrada(input: {
  conocimientoId: string;
  cuentaId: string;
  titulo: string;
  contenido: string;
}): Promise<ResumenIndexacion> {
  const resumen: ResumenIndexacion = {
    conocimiento_id: input.conocimientoId,
    chunks_generados: 0,
    bytes_indexados: 0,
  };

  // Siempre limpiamos los chunks viejos antes de re-indexar
  await borrarChunksDeEntrada(input.conocimientoId);

  // El titulo se prepende a cada chunk para mejorar retrieval — el
  // embedding de un chunk "promociones de fin de año\n\n[texto]"
  // matchea mejor consultas relacionadas al titulo.
  const tituloPrefix = input.titulo.trim() ? `${input.titulo.trim()}\n\n` : "";
  const chunks = chunkear(input.contenido).map((c) => tituloPrefix + c);
  if (chunks.length === 0) return resumen;

  let embeddings: number[][];
  try {
    embeddings = await generarEmbeddingsBatch(chunks);
  } catch (err) {
    console.error("[rag:indexar] error generando embeddings:", err);
    resumen.error = err instanceof Error ? err.message : String(err);
    return resumen;
  }

  if (embeddings.length !== chunks.length) {
    resumen.error = `mismatch: ${chunks.length} chunks vs ${embeddings.length} embeddings`;
    return resumen;
  }

  const filas = chunks.map((contenido, i) => ({
    conocimiento_id: input.conocimientoId,
    cuenta_id: input.cuentaId,
    orden: i,
    contenido,
    embedding: embeddings[i]!,
  }));

  await insertarChunks(filas);

  resumen.chunks_generados = filas.length;
  resumen.bytes_indexados = chunks.reduce((acc, c) => acc + c.length, 0);
  return resumen;
}

/**
 * Re-indexa TODAS las entradas activas de una cuenta. Útil para
 * backfill cuando se activa RAG por primera vez.
 */
export async function reindexarCuenta(
  cuentaId: string,
  entradas: Array<{ id: string; titulo: string; contenido: string; esta_activo: boolean }>,
): Promise<{
  entradas_procesadas: number;
  chunks_totales: number;
  errores: number;
}> {
  let chunks = 0;
  let errores = 0;
  const activas = entradas.filter((e) => e.esta_activo);

  for (const e of activas) {
    try {
      const r = await indexarEntrada({
        conocimientoId: e.id,
        cuentaId,
        titulo: e.titulo,
        contenido: e.contenido,
      });
      if (r.error) errores += 1;
      else chunks += r.chunks_generados;
    } catch (err) {
      console.error(`[rag:reindexar] error en entrada ${e.id}:`, err);
      errores += 1;
    }
  }

  return {
    entradas_procesadas: activas.length,
    chunks_totales: chunks,
    errores,
  };
}
