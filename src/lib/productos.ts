/**
 * Helpers para guardar imágenes y videos de productos en Supabase Storage.
 *
 * Path convention: `<cuentaId>/<archivo>` (mismo formato que se guarda en
 * la columna `productos.imagen_path` / `productos.video_path` de la DB).
 *
 * Servido vía GET /api/productos/<idCuenta>/<archivo>.
 */
import crypto from "node:crypto";
import {
  borrarArchivo,
  descargarArchivo,
  subirArchivo,
} from "./supabase/almacenamiento";

const BUCKET = "productos" as const;

function extensionSegura(nombre: string, mime: string | null): string {
  const e = (nombre.split(".").pop() ?? "").toLowerCase();
  if (e && ["jpg", "jpeg", "png", "webp", "gif"].includes(e)) {
    return e === "jpeg" ? "jpg" : e;
  }
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("gif")) return "gif";
  return "jpg";
}

function extensionVideoSegura(nombre: string, mime: string | null): string {
  const e = (nombre.split(".").pop() ?? "").toLowerCase();
  if (e && ["mp4", "webm", "mov", "m4v"].includes(e)) {
    return e === "mov" ? "mov" : e;
  }
  if (mime?.includes("webm")) return "webm";
  if (mime?.includes("quicktime")) return "mov";
  return "mp4";
}

function mimeDeExtensionImagen(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function mimeDeExtensionVideo(ext: string): string {
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "video/mp4";
}

/**
 * Sube una imagen de producto a Storage. Devuelve la ruta relativa
 * `<cuentaId>/<archivo>` que se guarda en `productos.imagen_path`.
 */
export async function guardarImagenProducto(
  cuentaId: string,
  buffer: Buffer,
  nombreOriginal: string,
  mimeType: string | null,
): Promise<{ rutaRelativa: string; nombreArchivo: string }> {
  const ext = extensionSegura(nombreOriginal, mimeType);
  const nombreArchivo = `${Date.now()}_${crypto
    .randomBytes(4)
    .toString("hex")}.${ext}`;
  await subirArchivo(
    BUCKET,
    cuentaId,
    nombreArchivo,
    buffer,
    mimeDeExtensionImagen(ext),
  );
  return {
    rutaRelativa: `${cuentaId}/${nombreArchivo}`,
    nombreArchivo,
  };
}

/**
 * Borra el archivo de Storage.
 */
export async function borrarImagenProducto(
  rutaRelativa: string | null,
): Promise<void> {
  if (!rutaRelativa) return;
  try {
    await borrarArchivo(BUCKET, rutaRelativa);
  } catch {
    // ya no existe
  }
}

/**
 * Igual que guardarImagenProducto pero para videos.
 */
export async function guardarVideoProducto(
  cuentaId: string,
  buffer: Buffer,
  nombreOriginal: string,
  mimeType: string | null,
): Promise<{ rutaRelativa: string; nombreArchivo: string }> {
  const ext = extensionVideoSegura(nombreOriginal, mimeType);
  const nombreArchivo = `vid_${Date.now()}_${crypto
    .randomBytes(4)
    .toString("hex")}.${ext}`;
  await subirArchivo(
    BUCKET,
    cuentaId,
    nombreArchivo,
    buffer,
    mimeDeExtensionVideo(ext),
  );
  return {
    rutaRelativa: `${cuentaId}/${nombreArchivo}`,
    nombreArchivo,
  };
}

export const borrarVideoProducto = borrarImagenProducto;

/**
 * Lee un archivo de productos desde Storage. Usado por el GET
 * /api/productos/<idCuenta>/<archivo>.
 */
export async function leerArchivoProducto(
  rutaRelativa: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  return descargarArchivo(BUCKET, rutaRelativa);
}
