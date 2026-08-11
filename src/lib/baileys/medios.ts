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

// Logger Baileys interno para downloadMediaMessage. Nivel "warn" para
// ver mensajes de fallo de descifrado / sesión sin spamear el terminal
// con cada chunk descargado.
const logger = pino({ level: "warn" });

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
 * `media-chats` de Supabase Storage.
 *
 * Reintenta una vez si la primera pasada falla — la mayoría de errores
 * "media not found" / "bad MAC" se resuelven en el segundo intento
 * porque Baileys regenera la sesión Signal entremedio.
 */
export async function descargarYGuardarMedia(
  sock: WASocket,
  msg: WAMessage,
  cuentaId: string,
  tipo: TipoMensaje,
  mime: string | null,
): Promise<MediaDescargado | null> {
  const inner = desempacarMensaje(msg.message);
  const msgParaDescargar: WAMessage = inner
    ? { ...msg, message: inner }
    : msg;

  let buffer: Buffer | null = null;
  let ultimoError: unknown = null;
  for (let intento = 1; intento <= 2; intento++) {
    try {
      buffer = await downloadMediaMessage(
        msgParaDescargar,
        "buffer",
        {},
        {
          reuploadRequest: sock.updateMediaMessage,
          logger,
        },
      );
      if (buffer && buffer.length > 0) break;
      buffer = null;
      console.warn(
        `[media:${tipo}] buffer vacío en intento ${intento}/2 (mime=${mime ?? "?"})`,
      );
    } catch (err) {
      ultimoError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[media:${tipo}] intento ${intento}/2 falló (mime=${mime ?? "?"}): ${msg.slice(0, 200)}`,
      );
    }
    // Backoff corto entre intentos — da tiempo a que Baileys re-handshake
    if (intento < 2) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (!buffer || buffer.length === 0) {
    if (ultimoError) {
      console.error(`[media:${tipo}] descarga falló definitivamente:`, ultimoError);
    }
    return null;
  }

  try {
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
    console.error(`[media:${tipo}] error subiendo a Storage:`, err);
    return null;
  }
}

/**
 * Transcribe un audio con Whisper, con respaldo en Gemini.
 *
 * Si Whisper no está disponible (cuenta de OpenAI caída, cuota, red), el
 * audio se transcribe con Gemini en vez de perderse: una nota de voz sin
 * transcribir deja al agente respondiendo a ciegas, y eso no se nota hasta
 * que el cliente ya se fue.
 *
 * Whisper cobra USD 0.006 por minuto. Estimamos duración del audio por
 * tamaño del buffer (audio comprimido ≈ 16 kbps OGG/Opus).
 */
export async function transcribirAudio(
  buffer: Buffer,
  nombreSugerido = "audio.ogg",
  cuentaId?: string,
): Promise<string | null> {
  const { transcribirConGemini } = await import("../transcripcionRespaldo");

  if (!process.env.OPENAI_API_KEY) {
    console.warn("[media] no hay OPENAI_API_KEY, transcribiendo con Gemini");
    return transcribirConGemini(buffer, nombreSugerido, cuentaId);
  }
  try {
    const archivo = await OpenAI.toFile(buffer, nombreSugerido);
    const { conReintentos } = await import("../reintentos");
    const transcripcion = await conReintentos(
      () =>
        cliente.audio.transcriptions.create({
          file: archivo,
          model: "whisper-1",
          language: "es",
        }),
      { contexto: "whisper", maxIntentos: 2, baseMs: 800 },
    );
    if (cuentaId) {
      // Estimación: OGG/Opus ≈ 2000 bytes/seg → segundos = bytes/2000.
      const segundos = Math.max(1, Math.round(buffer.length / 2000));
      const { registrarUso } = await import("../db/meteringUso");
      registrarUso({
        cuenta_id: cuentaId,
        proveedor: "whisper",
        modelo: "whisper-1",
        segundos,
        costo_usd: (segundos / 60) * 0.006,
      });
    }
    const texto = transcripcion.text?.trim();
    // Whisper puede responder 200 con texto vacío (audio ruidoso o mudo).
    // No es un fallo del proveedor, así que no vale la pena reintentar.
    return texto || null;
  } catch (err) {
    console.error("[media] error transcribiendo con Whisper:", err);
    return transcribirConGemini(buffer, nombreSugerido, cuentaId);
  }
}

/**
 * Sube un buffer arbitrario al bucket `media-chats`.
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
 * Lee un archivo del bucket `media-chats`.
 */
export async function descargarMediaChat(
  mediaPath: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  return descargarArchivo("media-chats", mediaPath);
}

/**
 * Borra un archivo del bucket `media-chats`.
 */
export async function borrarMediaChat(mediaPath: string): Promise<void> {
  try {
    await borrarArchivo("media-chats", mediaPath);
  } catch {
    // ya no existe
  }
}

// ============================================================
// Biblioteca de medios reutilizables (separada de chats)
// ============================================================

/**
 * Sube un archivo a la biblioteca del usuario.
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
 * Lee un medio de biblioteca.
 */
export async function descargarBiblioteca(
  rutaRelativa: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  return descargarArchivo("biblioteca", rutaRelativa);
}

/**
 * Lee la imagen interna de un producto (bucket `productos`).
 */
export async function descargarProductoImagen(
  rutaRelativa: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  return descargarArchivo("productos", rutaRelativa);
}

/**
 * Borra un medio de biblioteca.
 */
export async function borrarMedioBibliotecaArchivo(
  rutaRelativa: string,
): Promise<void> {
  try {
    await borrarArchivo("biblioteca", rutaRelativa);
  } catch {
    // ya no existe
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
