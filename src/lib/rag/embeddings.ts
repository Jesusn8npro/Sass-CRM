/**
 * Wrapper de OpenAI embeddings. Usa text-embedding-3-small:
 *   - 1536 dimensiones
 *   - $0.02 por 1M tokens (≈$0.0001 por entrada de 5K palabras)
 *   - calidad mas que suficiente para RAG en español
 *
 * Soporta batch (hasta 2048 inputs por llamada). Si pasas un solo
 * string, devuelve un solo embedding. Si pasas array, devuelve array.
 */
import OpenAI from "openai";

const MODELO = "text-embedding-3-small";
const DIMENSIONES = 1536;

let _cliente: OpenAI | null = null;
function cliente(): OpenAI {
  if (!_cliente) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no está seteada");
    _cliente = new OpenAI({ apiKey });
  }
  return _cliente;
}

/**
 * Genera el embedding de un solo texto. Devuelve array de 1536
 * floats. Trunca a 8K chars como guard (text-embedding-3-small
 * acepta hasta 8191 tokens).
 */
export async function generarEmbedding(texto: string): Promise<number[]> {
  const limpio = texto.trim().slice(0, 8000);
  if (!limpio) {
    throw new Error("[embeddings] no se puede embeddear texto vacio");
  }
  const r = await cliente().embeddings.create({
    model: MODELO,
    input: limpio,
    dimensions: DIMENSIONES,
  });
  const vec = r.data[0]?.embedding;
  if (!vec) throw new Error("[embeddings] respuesta vacia de OpenAI");
  return vec;
}

/**
 * Genera embeddings para varios textos a la vez (mas eficiente que
 * llamar uno a la vez). Mantiene el orden.
 */
export async function generarEmbeddingsBatch(
  textos: string[],
): Promise<number[][]> {
  if (textos.length === 0) return [];
  const limpios = textos.map((t) => t.trim().slice(0, 8000)).filter(Boolean);
  if (limpios.length === 0) return [];

  const r = await cliente().embeddings.create({
    model: MODELO,
    input: limpios,
    dimensions: DIMENSIONES,
  });
  return r.data.map((d) => d.embedding);
}
