/**
 * Respaldo de text-to-speech con Gemini, para cuando ElevenLabs no puede.
 *
 * ElevenLabs cobra por caracter y su cuota mensual se agota — y cuando eso
 * pasa, el agente deja de mandar notas de voz y cae a texto, justo en el
 * modo espejo_voz donde el cliente escribió por voz y espera voz. Gemini
 * tiene TTS nativo dentro de su cuota general, así que sirve de red.
 *
 * Gemini devuelve PCM crudo (L16 24kHz mono), no un contenedor. Lo pasamos
 * por ffmpeg a MP3 para devolver el MISMO formato que ElevenLabs y que el
 * resto del pipeline (que ya convierte a OGG/Opus para el ptt) no cambie.
 */
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { registrarUso } from "./db/meteringUso";
import { log } from "./logger";
import type { ResultadoTTS } from "./elevenlabs";

const MODELO_TTS_GEMINI =
  process.env.GEMINI_MODELO_TTS ?? "gemini-2.5-flash-preview-tts";

/**
 * Voz por defecto. Gemini expone un catálogo de voces prearmadas; Charon
 * es masculina y neutra, la más parecida al tono del agente. Se puede
 * cambiar por cuenta con GEMINI_VOZ.
 */
const VOZ_GEMINI = process.env.GEMINI_VOZ ?? "Charon";

/** Gemini cobra el TTS como tokens de salida de audio. */
const USD_POR_MILLON_TOKENS = 10;

/** Timeout: si Gemini cuelga, no dejamos trabada la respuesta de WhatsApp. */
const TIMEOUT_MS = 30_000;

/**
 * Convierte PCM crudo a MP3 con ffmpeg, por stdin/stdout (sin tocar disco).
 * Gemini entrega signed 16-bit little-endian, 24 kHz, mono.
 */
function pcmAMp3(pcm: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegPath;
    if (!bin) return reject(new Error("ffmpeg-static no devolvió ruta válida"));

    const proc = spawn(bin, [
      "-f", "s16le",      // formato de entrada: PCM 16 bits little-endian
      "-ar", "24000",     // sample rate que usa Gemini
      "-ac", "1",         // mono
      "-i", "pipe:0",
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-f", "mp3",
      "pipe:1",
    ]);

    const trozos: Buffer[] = [];
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => trozos.push(d));
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg salió con código ${code}: ${stderr.slice(-300)}`));
      }
      const salida = Buffer.concat(trozos);
      if (salida.length === 0) return reject(new Error("ffmpeg generó audio vacío"));
      resolve(salida);
    });

    proc.stdin.on("error", () => {
      /* si ffmpeg muere antes de leer todo, ya lo reporta el close */
    });
    proc.stdin.end(pcm);
  });
}

/**
 * Genera audio con Gemini y lo devuelve en MP3, igual que ElevenLabs.
 * Tira error si falla — el caller decide si cae a texto.
 */
export async function generarAudioRespaldo(
  texto: string,
  cuentaId?: string,
): Promise<ResultadoTTS> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no está definida — no hay respaldo de voz.");

  const limpio = texto.trim();
  if (!limpio) throw new Error("texto vacío para TTS.");

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_TTS_GEMINI}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: limpio }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ_GEMINI } },
            },
          },
        }),
        signal: ctrl.signal,
      },
    );

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => "");
      throw new Error(`Gemini TTS respondió ${resp.status}: ${detalle.slice(0, 200)}`);
    }

    const datos = (await resp.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };
    const base64 = datos.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) throw new Error("Gemini TTS no devolvió audio.");

    const mp3 = await pcmAMp3(Buffer.from(base64, "base64"));

    if (cuentaId) {
      const tokens = datos.usageMetadata?.totalTokenCount ?? 0;
      registrarUso({
        cuenta_id: cuentaId,
        proveedor: "gemini",
        modelo: MODELO_TTS_GEMINI,
        tokens_out: tokens,
        costo_usd: (tokens * USD_POR_MILLON_TOKENS) / 1_000_000,
        metadata: { motivo: "respaldo_elevenlabs", voz: VOZ_GEMINI },
      });
    }

    log.info(
      { bytes: mp3.length, voz: VOZ_GEMINI },
      "[tts:respaldo] audio generado con Gemini",
    );
    return { buffer: mp3, extension: "mp3", mime: "audio/mpeg" };
  } finally {
    clearTimeout(timeout);
  }
}
