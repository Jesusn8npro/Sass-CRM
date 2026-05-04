/**
 * Parte texto largo en chunks de tamaño parecido para indexar y
 * embeddings. Estrategia simple: respetar boundaries de párrafo y
 * frase cuando se puede; si un párrafo es más grande que el target,
 * lo cortamos por frase.
 *
 * No usamos tiktoken para no traer la dependencia: aproximamos
 * tokens como chars/4 (regla de pulgar para texto en español).
 */

const CHARS_POR_TOKEN_APROX = 4;
const TARGET_TOKENS = 400;
const MAX_TOKENS = 600;
const MIN_TOKENS = 100;

const TARGET_CHARS = TARGET_TOKENS * CHARS_POR_TOKEN_APROX; // 1600
const MAX_CHARS = MAX_TOKENS * CHARS_POR_TOKEN_APROX; // 2400
const MIN_CHARS = MIN_TOKENS * CHARS_POR_TOKEN_APROX; // 400

/**
 * Devuelve un array de chunks. Cada chunk apunta a ~400 tokens (1600
 * chars). El último chunk puede ser más chico. Los chunks NO se
 * solapan — para texto típico el contexto es suficiente sin overlap.
 */
export function chunkear(texto: string): string[] {
  const limpio = texto.trim();
  if (limpio.length === 0) return [];
  if (limpio.length <= MAX_CHARS) return [limpio];

  // Partir por párrafo (doble newline)
  const parrafos = limpio
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buffer = "";

  for (const p of parrafos) {
    const tentativo = buffer ? `${buffer}\n\n${p}` : p;

    if (tentativo.length <= TARGET_CHARS) {
      buffer = tentativo;
      continue;
    }

    // Si agregar este parrafo excede el target, cerramos el actual
    // (si tiene tamaño minimo) y empezamos uno nuevo.
    if (buffer.length >= MIN_CHARS) {
      chunks.push(buffer);
      buffer = "";
    }

    // Si el parrafo solo es más grande que el max, lo cortamos por frase.
    if (p.length > MAX_CHARS) {
      chunks.push(...partirPorFrase(p));
    } else if (buffer.length === 0) {
      buffer = p;
    } else {
      // El buffer tenia algo chico que no llego a min — lo concatenamos
      // igual con este parrafo aunque pase el target.
      buffer = `${buffer}\n\n${p}`.slice(0, MAX_CHARS);
    }
  }

  if (buffer.trim().length > 0) chunks.push(buffer);

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Para parrafos gigantes (ej: tabla, lista larga, texto sin saltos
 * de linea), partimos por frase respetando puntos.
 */
function partirPorFrase(parrafo: string): string[] {
  // Split por ". " conservando el punto
  const frases = parrafo
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const chunks: string[] = [];
  let buffer = "";
  for (const f of frases) {
    const tentativo = buffer ? `${buffer} ${f}` : f;
    if (tentativo.length <= TARGET_CHARS) {
      buffer = tentativo;
    } else {
      if (buffer.length > 0) chunks.push(buffer);
      // Frase super larga: corte duro por chars
      if (f.length > MAX_CHARS) {
        for (let i = 0; i < f.length; i += TARGET_CHARS) {
          chunks.push(f.slice(i, i + TARGET_CHARS));
        }
        buffer = "";
      } else {
        buffer = f;
      }
    }
  }
  if (buffer.length > 0) chunks.push(buffer);
  return chunks;
}
