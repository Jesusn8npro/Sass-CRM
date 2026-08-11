/**
 * Respaldo de transcripción cuando Whisper (OpenAI) no está disponible.
 *
 * Los audios de WhatsApp se transcriben con Whisper. Si la cuenta de OpenAI
 * está caída, `transcribirAudio` devolvía null en silencio y el agente
 * recibía "[audio sin transcripción]": el cliente manda una nota de voz
 * preguntando un precio y el bot le responde cualquier cosa. Peor que un
 * error, porque nadie se entera.
 *
 * Gemini 2.5 Flash acepta audio nativo, así que sirve de respaldo directo.
 */
import { registrarUso } from "./db/meteringUso";
import { log } from "./logger";

const MODELO_GEMINI = process.env.GEMINI_MODELO_AUDIO ?? "gemini-2.5-flash";

/** Precio de Gemini Flash por millón de tokens de entrada de audio (USD). */
const USD_POR_MILLON_AUDIO = 1.0;

/** MIME que Gemini entiende, deducido de la extensión del archivo. */
function mimeDeAudio(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mp3") return "audio/mp3";
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "aac") return "audio/aac";
  if (ext === "flac") return "audio/flac";
  // WhatsApp manda notas de voz en OGG/Opus.
  return "audio/ogg";
}

/**
 * Transcribe con Gemini. Devuelve el texto o null si no se pudo.
 * Nunca lanza: es un respaldo, y si falla el caller ya tiene su propio
 * camino de degradación.
 */
export async function transcribirConGemini(
  buffer: Buffer,
  nombreSugerido = "audio.ogg",
  cuentaId?: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Transcribí este audio en español, palabra por palabra. " +
                    "Devolvé SOLO la transcripción, sin comillas, sin comentarios " +
                    "y sin describir el audio. Si no se entiende nada, devolvé una cadena vacía.",
                },
                {
                  inline_data: {
                    mime_type: mimeDeAudio(nombreSugerido),
                    data: buffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        }),
      },
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      log.error(
        { status: respuesta.status, detalle: detalle.slice(0, 200) },
        "[transcripcion:respaldo] Gemini rechazó el audio",
      );
      return null;
    }

    const datos = (await respuesta.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; totalTokenCount?: number };
    };

    const texto =
      datos.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() ?? "";

    if (cuentaId) {
      const tokens = datos.usageMetadata?.totalTokenCount ?? 0;
      registrarUso({
        cuenta_id: cuentaId,
        proveedor: "gemini",
        modelo: MODELO_GEMINI,
        tokens_in: datos.usageMetadata?.promptTokenCount ?? 0,
        costo_usd: (tokens * USD_POR_MILLON_AUDIO) / 1_000_000,
        metadata: { motivo: "respaldo_whisper_caido" },
      });
    }

    if (texto) {
      log.info(
        { chars: texto.length },
        "[transcripcion:respaldo] audio transcrito con Gemini",
      );
    }
    return texto || null;
  } catch (err) {
    log.error({ err: String(err) }, "[transcripcion:respaldo] error con Gemini");
    return null;
  }
}
