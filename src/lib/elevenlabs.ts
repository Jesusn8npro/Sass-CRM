/**
 * Cliente para text-to-speech de ElevenLabs.
 *
 * Doc: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 *
 * Variables de entorno:
 *   - ELEVENLABS_API_KEY: tu API key (en .env.local)
 *
 * Por cuenta de WhatsApp se configura el voz_id (en cuentas.voz_elevenlabs).
 * Si está vacío/null, no se genera audio y la respuesta sale como texto normal.
 */

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

/**
 * Modelo recomendado para multilenguaje incluido español.
 * eleven_multilingual_v2 es el balance calidad/costo para nuestro caso.
 */
const MODELO_TTS = "eleven_multilingual_v2";

export interface ResultadoTTS {
  buffer: Buffer;
  /** Extensión del archivo (siempre mp3 para nuestra config). */
  extension: string;
  /** Mime type del audio. */
  mime: string;
}

/**
 * Genera audio MP3 a partir de texto usando una voz de ElevenLabs.
 * Tira error si falla (rate limit, voz inválida, etc).
 */
export async function generarAudioTTS(
  texto: string,
  vozId: string,
): Promise<ResultadoTTS> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY no está definida. Agregala a .env.local.",
    );
  }
  if (!vozId.trim()) {
    throw new Error("voz_id vacío.");
  }

  const url = `${ENDPOINT}/${encodeURIComponent(vozId.trim())}?output_format=mp3_44100_128`;
  const respuesta = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: texto,
      model_id: MODELO_TTS,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    // El 402 paid_plan_required pasa cuando se intenta usar una voz de
    // la biblioteca personal con plan free. Devolvemos un mensaje más
    // útil que el JSON crudo de ElevenLabs.
    if (respuesta.status === 402 && cuerpo.includes("paid_plan_required")) {
      throw new Error(
        "Esta voz es de tu biblioteca personal y requiere plan pago de ElevenLabs. " +
          "Cambiá a una voz default (Sarah: EXAVITQu4vr4xnSDxMaL, Aria: 9BWtsMINqrJLrRacOk9x, " +
          "Rachel: 21m00Tcm4TlvDq8ikWAM, Adam: pNInz6obpgDQGcFmaJgB, Antoni: ErXwobaYiN019PkySvjV).",
      );
    }
    throw new Error(
      `ElevenLabs error ${respuesta.status}: ${cuerpo.slice(0, 300)}`,
    );
  }

  const arrayBuffer = await respuesta.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, extension: "mp3", mime: "audio/mpeg" };
}
