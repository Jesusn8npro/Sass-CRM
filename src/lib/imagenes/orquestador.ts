/**
 * Orquesta el flujo completo de "generar imagen para producto":
 * 1) descontar créditos atómicamente
 * 2) opcionalmente bajar la imagen base del producto desde Storage
 * 3) llamar a Nano Banana
 * 4) subir el PNG resultado al bucket `biblioteca`
 * 5) si la API falló → reintegrar créditos
 *
 * El caller (route handler) usa `generarImagenProducto` y se queda con
 * `media_path` para guardarlo donde quiera (producto.imagen_url, biblio).
 */
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requerirCreditos } from "../creditos/guard";
import {
  descargarArchivo,
  subirArchivo,
} from "../supabase/almacenamiento";
import { generarImagen } from "./nanoBanana";

interface Resultado {
  rutaRelativa: string;
  bucket: "biblioteca";
  bytes: number;
}

/**
 * Genera y guarda. Devuelve NextResponse 402 si no hay créditos.
 * En caso de error de la API, reintegra los créditos antes de lanzar.
 */
export async function generarImagenProducto(input: {
  cuentaId: string;
  prompt: string;
  /** Si está, usamos image-to-image. Path relativo dentro del bucket
   *  `productos` o `biblioteca` (con prefijo `biblio:` para forzar). */
  rutaImagenBase?: string | null;
}): Promise<Resultado | NextResponse> {
  const guard = await requerirCreditos(input.cuentaId, "imagen_nano_banana", {
    metadataInicial: {
      prompt_preview: input.prompt.slice(0, 120),
      tiene_base: !!input.rutaImagenBase,
    },
  });
  if (guard instanceof NextResponse) return guard;

  try {
    let imagenBase:
      | { mimetype: string; bytes: Buffer }
      | undefined;
    if (input.rutaImagenBase) {
      const { bucket, ruta } = resolverBucket(input.rutaImagenBase);
      const desc = await descargarArchivo(bucket, ruta);
      if (desc) {
        imagenBase = { mimetype: desc.mime, bytes: desc.buffer };
      }
    }

    const { pngBytes, mimetype } = await generarImagen(
      input.prompt,
      imagenBase,
    );

    const nombre = `gen_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.png`;
    const { ruta } = await subirArchivo(
      "biblioteca",
      input.cuentaId,
      nombre,
      pngBytes,
      mimetype,
    );

    return { rutaRelativa: ruta, bucket: "biblioteca", bytes: pngBytes.length };
  } catch (err) {
    // API falló, reintegramos
    await guard.refund();
    throw err;
  }
}

/**
 * Convierte una ruta interna a (bucket, ruta dentro del bucket).
 * Aceptamos:
 *   - "biblio:UUID/archivo"  → bucket biblioteca
 *   - "UUID/archivo.png"     → bucket productos por default
 */
function resolverBucket(ruta: string): {
  bucket: "productos" | "biblioteca";
  ruta: string;
} {
  if (ruta.startsWith("biblio:")) {
    return { bucket: "biblioteca", ruta: ruta.slice("biblio:".length) };
  }
  return { bucket: "productos", ruta };
}
