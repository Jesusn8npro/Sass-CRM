import path from "node:path";
import fs from "node:fs";
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

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const directorioMediaBase = path.resolve(process.cwd(), "data", "media");
const directorioBibliotecaBase = path.resolve(
  process.cwd(),
  "data",
  "biblioteca",
);

// Logger silencioso requerido por DownloadMediaMessageContext
const logger = pino({ level: "silent" });

function asegurarDirectorio(ruta: string): void {
  if (!fs.existsSync(ruta)) {
    fs.mkdirSync(ruta, { recursive: true });
  }
}

function rutaMediaCuenta(cuentaId: number): string {
  const dir = path.join(directorioMediaBase, String(cuentaId));
  asegurarDirectorio(dir);
  return dir;
}

function extensionParaMime(mime: string | null | undefined, fallback: string): string {
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

/**
 * Desempaqueta wrappers de WhatsApp (ephemeral, view-once, document-with-caption,
 * etc) recursivamente, devolviendo el IMessage interno con el contenido real.
 *
 * Sin esto, mensajes enviados como "una sola vista" o de chats efímeros
 * vienen anidados y nuestro detectorTipoMedia no los reconoce.
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
  rutaAbsoluta: string;
  rutaRelativa: string;
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
 * Descarga el contenido multimedia de un mensaje y lo guarda en disco.
 * Pasa el mensaje desempaquetado (sin wrappers ephemeral/viewOnce) a
 * downloadMediaMessage para que pueda extraer las claves de descifrado.
 */
export async function descargarYGuardarMedia(
  sock: WASocket,
  msg: WAMessage,
  cuentaId: number,
  tipo: TipoMensaje,
  mime: string | null,
): Promise<MediaDescargado | null> {
  try {
    const inner = desempacarMensaje(msg.message);
    // Construir un mensaje con el contenido desempaquetado para que
    // downloadMediaMessage no se confunda con los wrappers.
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
    const dir = rutaMediaCuenta(cuentaId);
    const nombre = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const rutaAbsoluta = path.join(dir, nombre);
    fs.writeFileSync(rutaAbsoluta, buffer);

    return {
      rutaAbsoluta,
      rutaRelativa: `${cuentaId}/${nombre}`,
      nombreArchivo: nombre,
      mime,
      tamano: buffer.length,
    };
  } catch (err) {
    console.error("[media] error descargando:", err);
    return null;
  }
}

export async function transcribirAudio(rutaAbsoluta: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[media] no hay OPENAI_API_KEY, no se puede transcribir");
    return null;
  }
  try {
    const transcripcion = await cliente.audio.transcriptions.create({
      file: fs.createReadStream(rutaAbsoluta),
      model: "whisper-1",
      language: "es",
    });
    return transcripcion.text?.trim() || null;
  } catch (err) {
    console.error("[media] error transcribiendo:", err);
    return null;
  }
}

export function rutaAbsolutaDeMedia(mediaPath: string): string {
  return path.join(directorioMediaBase, mediaPath);
}

export function guardarMediaSubido(
  cuentaId: number,
  buffer: Buffer,
  extension: string,
): MediaDescargado {
  const dir = rutaMediaCuenta(cuentaId);
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  const nombre = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const rutaAbsoluta = path.join(dir, nombre);
  fs.writeFileSync(rutaAbsoluta, buffer);
  return {
    rutaAbsoluta,
    rutaRelativa: `${cuentaId}/${nombre}`,
    nombreArchivo: nombre,
    mime: null,
    tamano: buffer.length,
  };
}

// ============================================================
// Biblioteca de medios reutilizables (separada de chats)
// ============================================================
function rutaBibliotecaCuenta(cuentaId: number): string {
  const dir = path.join(directorioBibliotecaBase, String(cuentaId));
  asegurarDirectorio(dir);
  return dir;
}

export function guardarEnBiblioteca(
  cuentaId: number,
  buffer: Buffer,
  extension: string,
): MediaDescargado {
  const dir = rutaBibliotecaCuenta(cuentaId);
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  const nombre = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const rutaAbsoluta = path.join(dir, nombre);
  fs.writeFileSync(rutaAbsoluta, buffer);
  return {
    rutaAbsoluta,
    rutaRelativa: `${cuentaId}/${nombre}`,
    nombreArchivo: nombre,
    mime: null,
    tamano: buffer.length,
  };
}

export function rutaAbsolutaDeBiblioteca(rutaRelativa: string): string {
  return path.join(directorioBibliotecaBase, rutaRelativa);
}
