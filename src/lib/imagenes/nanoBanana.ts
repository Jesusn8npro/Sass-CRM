/**
 * Wrapper de Google Gemini Image (familia "Nano Banana").
 * image-to-image y text-to-image. Devuelve PNG bytes listos para subir
 * a Supabase Storage.
 *
 * Configuración:
 *   GEMINI_API_KEY en .env (Google AI Studio).
 *
 * Modelos soportados (mayo 2026):
 *   - gemini-2.5-flash-image          → ~$0.039/img (legacy, default histórico)
 *   - gemini-3.1-flash-image-preview  → ~$0.039/img (Nano Banana 2, mejor calidad mismo precio)
 *   - gemini-3-pro-image-preview      → ~$0.134/img 1-2K, ~$0.24/img 4K (Pro: texto renderizado, layouts)
 */
import { GoogleGenAI } from "@google/genai";

export type ModeloImagen =
  | "gemini-2.5-flash-image"
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview";

const MODELO_DEFAULT: ModeloImagen = "gemini-2.5-flash-image";

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
  modeloUsado: ModeloImagen;
}

/**
 * Genera una imagen a partir de un prompt + opcionalmente una imagen
 * base (image-to-image). Devuelve PNG bytes.
 *
 * `opciones.modelo` permite forzar Pro o Banana 2 sin tocar callers
 * existentes (legacy sigue usando 2.5-flash-image por defecto).
 */
export async function generarImagen(
  prompt: string,
  imagenBase?: { mimetype: string; bytes: Buffer },
  opciones?: { modelo?: ModeloImagen },
): Promise<ResultadoImagen> {
  const modelo = opciones?.modelo ?? MODELO_DEFAULT;
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
    model: modelo,
    contents: partes,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
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
    modeloUsado: modelo,
  };
}
