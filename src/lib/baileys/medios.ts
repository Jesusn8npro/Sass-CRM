import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import {
  downloadMediaMessage,
  type WAMessage,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import pino from "pino";
import OpenAI from "openai";
import type { TipoMensaje } from "../baseDatos";
import {
  borrarArchivo,
  descargarArchivo,
  subirArchivo,
} from "../supabase/almacenamiento";

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

// Carpetas legacy locales — solo para fallback de lectura de archivos
// pre-cutover. Ya no escribimos acá.
const directorioMediaBaseLegacy = path.resolve(process.cwd(), "data", "media");
const directorioBibliotecaBaseLegacy = path.resolve(
  process.cwd(),
  "data",
  "biblioteca",
);

const logger = pino({ level: "silent" });

function extensionParaMime(
  mime: string | null | undefined,
  fallback: string,
): string {
  if (!mime) return fallback;
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("pdf")) return "pdf";
  return fallback;
}

function mimePorExtension(archivo: string): string {
  const ext = archivo.split(".").pop()?.toLowerCase() ?? "";
  const mapa: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    ogg: "audio/ogg",
    opus: "audio/ogg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    pdf: "application/pdf",
  };
  return mapa[ext] ?? "application/octet-stream";
}

/**
 * Desempaqueta wrappers de WhatsApp (ephemeral, view-once,
 * document-with-caption, etc) recursivamente.
 */
export function desempacarMensaje(
  msg: proto.IMessage | null | undefined,
): proto.IMessage | null {
  if (!msg) return null;
  if (msg.ephemeralMessage?.message)
    return desempacarMensaje(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message)
    return desempacarMensaje(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message)
    return desempacarMensaje(msg.viewOnceMessageV2.message);
  if (msg.viewOnceMessageV2Extension?.message)
    return desempacarMensaje(msg.viewOnceMessageV2Extension.message);
  if (msg.documentWithCaptionMessage?.message)
    return desempacarMensaje(msg.documentWithCaptionMessage.message);
  return msg;
}

export interface MediaDescargado {
  /** Path dentro del bucket: `<cuentaId>/<archivo>`. Lo guardamos en
   * la columna `media_path` de la DB. */
  rutaRelativa: string;
  /** Buffer en memoria — útil para procesar inmediato (Whisper, etc)
   * sin re-descargar de Storage. */
  buffer: Buffer;
  nombreArchivo: string;
  mime: string | null;
  tamano: number;
}

export function detectarTipoMedia(msg: WAMessage): {
  tipo: TipoMensaje;
  mime: string | null;
  caption: string | null;
} | null {
  const inner = desempacarMensaje(msg.message);
  if (!inner) return null;
  if (inner.audioMessage) {
    return {
      tipo: "audio",
      mime: inner.audioMessage.mimetype ?? null,
      caption: null,
    };
  }
  if (inner.imageMessage) {
    return {
      tipo: "imagen",
      mime: inner.imageMessage.mimetype ?? "image/jpeg",
      caption: inner.imageMessage.caption ?? null,
    };
  }
  if (inner.videoMessage) {
    return {
      tipo: "video",
      mime: inner.videoMessage.mimetype ?? "video/mp4",
      caption: inner.videoMessage.caption ?? null,
    };
  }
  if (inner.documentMessage) {
    return {
      tipo: "documento",
      mime: inner.documentMessage.mimetype ?? "application/octet-stream",
      caption: inner.documentMessage.fileName ?? null,
    };
  }
  return null;
}

/**
 * Descarga el contenido multimedia de un mensaje y lo sube al bucket
 * `media-chats` de Supabase Storage. Devuelve el buffer también para
 * que el caller pueda procesarlo inmediato (transcripción) sin
 * re-descargar.
 */
export async function descargarYGuardarMedia(
  sock: WASocket,
  msg: WAMessage,
  cuentaId: string,
  tipo: TipoMensaje,
  mime: string | null,
): Promise<MediaDescargado | null> {
  try {
    const inner = desempacarMensaje(msg.message);
    const msgParaDescargar: WAMessage = inner
      ? { ...msg, message: inner }
      : msg;

    const buffer = await downloadMediaMessage(
      msgParaDescargar,
      "buffer",
      {},
      {
        reuploadRequest: sock.updateMediaMessage,
        logger,
      },
    );
    if (!buffer || buffer.length === 0) {
      console.warn("[media] buffer vacío al descargar, se ignora");
      return null;
    }

    const fallbackExt =
      tipo === "audio"
        ? "ogg"
        : tipo === "imagen"
        ? "jpg"
        : tipo === "video"
        ? "mp4"
        : tipo === "documento"
        ? "bin"
        : "bin";
    const ext = extensionParaMime(mime, fallbackExt);
    const nombre = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    await subirArchivo(
      "media-chats",
      cuentaId,
      nombre,
      buffer,
      mime ?? mimePorExtension(nombre),
    );

    return {
      rutaRelativa: `${cuentaId}/${nombre}`,
      buffer,
      nombreArchivo: nombre,
      mime,
      tamano: buffer.length,
    };
  } catch (err) {
    console.error("[media] error descargando:", err);
    return null;
  }
}

/**
 * Transcribe un audio con Whisper a partir de un buffer en memoria.
 * (Antes recibía path a disco — ya no.)
 */
export async function transcribirAudio(
  buffer: Buffer,
  nombreSugerido = "audio.ogg",
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[media] no hay OPENAI_API_KEY, no se puede transcribir");
    return null;
  }
  try {
    const archivo = await OpenAI.toFile(buffer, nombreSugerido);
    const transcripcion = await cliente.audio.transcriptions.create({
      file: archivo,
      model: "whisper-1",
      language: "es",
    });
    return transcripcion.text?.trim() || null;
  } catch (err) {
    console.error("[media] error transcribiendo:", err);
    return null;
  }
}

/**
 * Sube un buffer arbitrario al bucket `media-chats` (TTS, uploads
 * manuales del panel, etc). Async porque va a Storage.
 */
export async function guardarMediaSubido(
  cuentaId: string,
  buffer: Buffer,
  extension: string,
): Promise<MediaDescargado> {
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  const nombre = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  await subirArchivo(
    "media-chats",
    cuentaId,
    nombre,
    buffer,
    mimePorExtension(nombre),
  );
  return {
    rutaRelativa: `${cuentaId}/${nombre}`,
    buffer,
    nombreArchivo: nombre,
    mime: mimePorExtension(nombre),
    tamano: buffer.length,
  };
}

/**
 * Lee un archivo del bucket `media-chats`. Si no existe en Storage
 * (legacy pre-cutover), cae a disco local.
 */
export async function descargarMediaChat(
  mediaPath: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const enStorage = await descargarArchivo("media-chats", mediaPath);
  if (enStorage) return enStorage;
  // Fallback legacy
  try {
    const abs = path.join(directorioMediaBaseLegacy, mediaPath);
    if (!fs.existsSync(abs)) return null;
    return {
      buffer: fs.readFileSync(abs),
      mime: mimePorExtension(abs),
    };
  } catch {
    return null;
  }
}

/**
 * Borra un archivo de chat (Storage + intento de borrar legacy local).
 */
export async function borrarMediaChat(mediaPath: string): Promise<void> {
  try {
    await borrarArchivo("media-chats", mediaPath);
  } catch {
    // ya no existe en Storage
  }
  try {
    const abs = path.join(directorioMediaBaseLegacy, mediaPath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignorar
  }
}

// ============================================================
// Biblioteca de medios reutilizables (separada de chats)
// ============================================================

/**
 * Sube un archivo a la biblioteca del usuario. Async — va a Storage
 * bucket `biblioteca`.
 */
export async function guardarEnBiblioteca(
  cuentaId: string,
  buffer: Buffer,
  extension: string,
): Promise<MediaDescargado> {
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  const nombre = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  await subirArchivo(
    "biblioteca",
    cuentaId,
    nombre,
    buffer,
    mimePorExtension(nombre),
  );
  return {
    rutaRelativa: `${cuentaId}/${nombre}`,
    buffer,
    nombreArchivo: nombre,
    mime: mimePorExtension(nombre),
    tamano: buffer.length,
  };
}

/**
 * Lee un medio de biblioteca. Storage primero, fallback local.
 */
export async function descargarBiblioteca(
  rutaRelativa: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const enStorage = await descargarArchivo("biblioteca", rutaRelativa);
  if (enStorage) return enStorage;
  try {
    const abs = path.join(directorioBibliotecaBaseLegacy, rutaRelativa);
    if (!fs.existsSync(abs)) return null;
    return {
      buffer: fs.readFileSync(abs),
      mime: mimePorExtension(abs),
    };
  } catch {
    return null;
  }
}

/**
 * Borra un medio de biblioteca (Storage + legacy).
 */
export async function borrarMedioBibliotecaArchivo(
  rutaRelativa: string,
): Promise<void> {
  try {
    await borrarArchivo("biblioteca", rutaRelativa);
  } catch {
    // ya no existe en Storage
  }
  try {
    const abs = path.join(directorioBibliotecaBaseLegacy, rutaRelativa);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignorar
  }
}

// ============================================================
// Helpers temp-file para Baileys / ffmpeg
// ============================================================

/**
 * Escribe un buffer a un archivo temporal (en os.tmpdir()) y devuelve
 * la ruta. Útil para casos donde necesitamos un path real (ffmpeg,
 * Baileys getAudioDuration / getAudioWaveform).
 *
 * El caller es responsable de borrar el archivo cuando termine.
 */
export function escribirTemporal(
  buffer: Buffer,
  extension: string,
): string {
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  const nombre = `bot_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const ruta = path.join(os.tmpdir(), nombre);
  fs.writeFileSync(ruta, buffer);
  return ruta;
}

/**
 * Borra un archivo (silencioso). Para cleanup de archivos temp.
 */
export function borrarTemporal(ruta: string): void {
  try {
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
  } catch {
    // ignorar
  }
}
