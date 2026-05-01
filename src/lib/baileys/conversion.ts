import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";

/**
 * Convierte un archivo de audio cualquiera (WebM, MP3, M4A, etc) al formato
 * que WhatsApp acepta para notas de voz: OGG con codec Opus, mono, 16kHz.
 *
 * Devuelve la ruta del archivo OGG generado. Si la conversión falla, lanza error.
 */
export async function convertirAOggOpus(
  rutaEntrada: string,
  rutaSalida: string,
): Promise<void> {
  const bin = ffmpegPath;
  if (!bin) {
    throw new Error("ffmpeg-static no devolvió ruta válida del binario");
  }

  return new Promise<void>((resolve, reject) => {
    const args: string[] = [
      "-y",
      "-i",
      rutaEntrada,
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "ogg",
      rutaSalida,
    ];
    const proc = spawn(bin, args);
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err: Error) => reject(err));
    proc.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `ffmpeg salió con código ${code}: ${stderr.slice(-500)}`,
          ),
        );
      }
    });
  });
}

/**
 * Helper de alto nivel: dado un archivo de audio cualquiera en disco,
 * crea un .ogg al lado y borra el original. Devuelve la ruta del .ogg
 * y su nombre. Si la conversión falla, devuelve el archivo original.
 */
export async function asegurarFormatoVoz(
  rutaAbsoluta: string,
): Promise<{ rutaAbsoluta: string; nombre: string }> {
  const ext = path.extname(rutaAbsoluta).toLowerCase();
  // Si ya es .ogg lo dejamos tal cual (asumimos OGG/Opus)
  if (ext === ".ogg") {
    return { rutaAbsoluta, nombre: path.basename(rutaAbsoluta) };
  }

  const dir = path.dirname(rutaAbsoluta);
  const baseName = path.basename(rutaAbsoluta, ext);
  const rutaSalida = path.join(dir, `${baseName}.ogg`);

  try {
    await convertirAOggOpus(rutaAbsoluta, rutaSalida);
    // Verificar que el archivo resultante exista y no esté vacío
    const stats = fs.statSync(rutaSalida);
    if (stats.size === 0) {
      throw new Error("ffmpeg generó archivo vacío");
    }
    // Borrar el original para no dejar basura
    try {
      fs.unlinkSync(rutaAbsoluta);
    } catch {
      // ignorar
    }
    return { rutaAbsoluta: rutaSalida, nombre: path.basename(rutaSalida) };
  } catch (err) {
    console.warn("[conversion] falló, se usará el archivo original:", err);
    return { rutaAbsoluta, nombre: path.basename(rutaAbsoluta) };
  }
}
