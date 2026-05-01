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

// ============================================================
// Metadata de una voz: nombre + URL de preview público
// ============================================================
export interface InfoVoz {
  voice_id: string;
  name: string;
  category: string;
  preview_url: string | null;
}

export async function obtenerInfoVoz(vozId: string): Promise<InfoVoz> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no está definida.");
  if (!vozId.trim()) throw new Error("voz_id vacío.");

  const url = `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(vozId.trim())}`;
  const respuesta = await fetch(url, {
    headers: { "xi-api-key": apiKey, Accept: "application/json" },
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    throw new Error(
      `ElevenLabs error ${respuesta.status}: ${cuerpo.slice(0, 300)}`,
    );
  }
  const data = (await respuesta.json()) as {
    voice_id: string;
    name?: string;
    category?: string;
    preview_url?: string;
  };
  return {
    voice_id: data.voice_id,
    name: data.name ?? "Sin nombre",
    category: data.category ?? "unknown",
    preview_url: data.preview_url ?? null,
  };
}

// ============================================================
// Listar todas las voces disponibles para esta API key
// (premade default + cloned + professional).
// Doc: https://elevenlabs.io/docs/api-reference/voices/get-all
// ============================================================
export async function listarVoces(): Promise<InfoVoz[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no está definida.");
  const respuesta = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey, Accept: "application/json" },
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    throw new Error(
      `ElevenLabs error ${respuesta.status}: ${cuerpo.slice(0, 300)}`,
    );
  }
  const data = (await respuesta.json()) as {
    voices?: Array<{
      voice_id: string;
      name?: string;
      category?: string;
      preview_url?: string;
    }>;
  };
  return (data.voices ?? []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name ?? "Sin nombre",
    category: v.category ?? "unknown",
    preview_url: v.preview_url ?? null,
  }));
}

// ============================================================
// Borrar una voz clonada
// ============================================================
export async function borrarVoz(vozId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no está definida.");
  if (!vozId.trim()) throw new Error("voz_id vacío.");
  const url = `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(vozId.trim())}`;
  const respuesta = await fetch(url, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    throw new Error(
      `ElevenLabs error ${respuesta.status}: ${cuerpo.slice(0, 300)}`,
    );
  }
}

// ============================================================
// Clonado instantáneo (IVC). Requiere plan Starter+.
// Doc: https://elevenlabs.io/docs/api-reference/voices/add
// ============================================================
export interface ResultadoClonado {
  voice_id: string;
}

export async function clonarVoz(
  nombre: string,
  archivo: { buffer: Buffer; nombreArchivo: string; tipoMime: string },
  descripcion?: string,
): Promise<ResultadoClonado> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no está definida.");
  if (!nombre.trim()) throw new Error("Nombre vacío.");

  const fd = new FormData();
  fd.append("name", nombre.trim());
  if (descripcion?.trim()) fd.append("description", descripcion.trim());
  // Web FormData necesita Blob/File para el binario.
  const blob = new Blob([new Uint8Array(archivo.buffer)], {
    type: archivo.tipoMime || "audio/mpeg",
  });
  fd.append("files", blob, archivo.nombreArchivo);

  const respuesta = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => "");
    if (respuesta.status === 401) {
      throw new Error("API key inválida o sin permisos para clonar voces.");
    }
    if (respuesta.status === 402 || cuerpo.includes("paid_plan_required")) {
      throw new Error(
        "Tu plan de ElevenLabs no permite clonar voces. Necesitás Starter ($5/mes) o superior.",
      );
    }
    throw new Error(
      `ElevenLabs error ${respuesta.status}: ${cuerpo.slice(0, 300)}`,
    );
  }
  const data = (await respuesta.json()) as { voice_id?: string };
  if (!data.voice_id) {
    throw new Error("ElevenLabs no devolvió voice_id.");
  }
  return { voice_id: data.voice_id };
}
