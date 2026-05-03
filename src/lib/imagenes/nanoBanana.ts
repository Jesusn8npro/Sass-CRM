/**
 * Wrapper de Google Gemini 2.5 Flash Image (alias "Nano Banana").
 * image-to-image y text-to-image. Devuelve PNG bytes listos para subir
 * a Supabase Storage.
 *
 * Configuración:
 *   GEMINI_API_KEY en .env (Google AI Studio).
 *
 * Costo aprox: $0.039 / imagen out (1290 tokens × $30/1M).
 */
import { GoogleGenAI } from "@google/genai";

const MODELO = "gemini-2.5-flash-image";

let _cliente: GoogleGenAI | null = null;
function cliente(): GoogleGenAI {
  if (!_cliente) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY no está seteada. Conseguíla en https://aistudio.google.com/apikey",
      );
    }
    _cliente = new GoogleGenAI({ apiKey });
  }
  return _cliente;
}

interface ResultadoImagen {
  pngBytes: Buffer;
  mimetype: string;
}

/**
 * Genera una imagen a partir de un prompt + opcionalmente una imagen
 * base (image-to-image). Devuelve PNG bytes.
 */
export async function generarImagen(
  prompt: string,
  imagenBase?: { mimetype: string; bytes: Buffer },
): Promise<ResultadoImagen> {
  const partes: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (imagenBase) {
    partes.push({
      inlineData: {
        mimeType: imagenBase.mimetype,
        data: imagenBase.bytes.toString("base64"),
      },
    });
  }
  partes.push({ text: prompt });

  const res = await cliente().models.generateContent({
    model: MODELO,
    contents: partes,
  });

  const candidato = res.candidates?.[0];
  if (!candidato?.content?.parts) {
    throw new Error("Gemini no devolvió contenido");
  }
  const parteImagen = candidato.content.parts.find(
    (p): p is { inlineData: { mimeType: string; data: string } } =>
      "inlineData" in p &&
      p.inlineData?.data !== undefined &&
      p.inlineData?.mimeType !== undefined,
  );
  if (!parteImagen) {
    // A veces el modelo devuelve sólo texto si rechazó el prompt.
    const texto = candidato.content.parts
      .filter((p): p is { text: string } => "text" in p && !!p.text)
      .map((p) => p.text)
      .join(" ");
    throw new Error(
      `Gemini no devolvió imagen. Respuesta: ${texto || "(vacía)"}`,
    );
  }

  return {
    pngBytes: Buffer.from(parteImagen.inlineData.data, "base64"),
    mimetype: parteImagen.inlineData.mimeType,
  };
}
