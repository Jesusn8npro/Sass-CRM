/**
 * Helpers para guardar imágenes de productos en disco bajo
 *   data/productos/<idCuenta>/<archivo>
 *
 * Reusa el patrón de medios/biblioteca: el panel sirve via
 *   GET /api/productos/<idCuenta>/<archivo>
 */
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const directorioBase = path.resolve(process.cwd(), "data", "productos");

function asegurarDir(ruta: string): void {
  if (!fs.existsSync(ruta)) fs.mkdirSync(ruta, { recursive: true });
}

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

export function rutaCarpetaProductos(cuentaId: number): string {
  const dir = path.join(directorioBase, String(cuentaId));
  asegurarDir(dir);
  return dir;
}

export function rutaAbsolutaImagenProducto(rutaRelativa: string): string {
  return path.join(directorioBase, rutaRelativa);
}

/**
 * Guarda el buffer de una imagen subida y devuelve { rutaRelativa, rutaAbsoluta }.
 * rutaRelativa tiene formato "<idCuenta>/<archivo>" para que el cliente
 * pueda construir la URL `/api/productos/<rutaRelativa>`.
 */
export function guardarImagenProducto(
  cuentaId: number,
  buffer: Buffer,
  nombreOriginal: string,
  mimeType: string | null,
): { rutaRelativa: string; rutaAbsoluta: string; nombreArchivo: string } {
  const dir = rutaCarpetaProductos(cuentaId);
  const ext = extensionSegura(nombreOriginal, mimeType);
  const nombreArchivo = `${Date.now()}_${crypto
    .randomBytes(4)
    .toString("hex")}.${ext}`;
  const rutaAbsoluta = path.join(dir, nombreArchivo);
  fs.writeFileSync(rutaAbsoluta, buffer);
  return {
    rutaRelativa: `${cuentaId}/${nombreArchivo}`,
    rutaAbsoluta,
    nombreArchivo,
  };
}

export function borrarImagenProducto(rutaRelativa: string | null): void {
  if (!rutaRelativa) return;
  try {
    const abs = path.join(directorioBase, rutaRelativa);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignorar — ya borrada o sin permisos
  }
}

/**
 * Igual que guardarImagenProducto pero para videos (mp4/webm/mov).
 */
export function guardarVideoProducto(
  cuentaId: number,
  buffer: Buffer,
  nombreOriginal: string,
  mimeType: string | null,
): { rutaRelativa: string; rutaAbsoluta: string; nombreArchivo: string } {
  const dir = rutaCarpetaProductos(cuentaId);
  const ext = extensionVideoSegura(nombreOriginal, mimeType);
  const nombreArchivo = `vid_${Date.now()}_${crypto
    .randomBytes(4)
    .toString("hex")}.${ext}`;
  const rutaAbsoluta = path.join(dir, nombreArchivo);
  fs.writeFileSync(rutaAbsoluta, buffer);
  return {
    rutaRelativa: `${cuentaId}/${nombreArchivo}`,
    rutaAbsoluta,
    nombreArchivo,
  };
}

export const borrarVideoProducto = borrarImagenProducto; // misma lógica
