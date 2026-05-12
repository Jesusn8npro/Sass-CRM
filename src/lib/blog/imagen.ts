/**
 * Genera y sube la imagen de portada de un artículo de blog.
 *
 * Usa Nano Banana (Gemini Image, familia) — mismo wrapper que el
 * estudio de productos. Diferencia con `imagenes/orquestador.ts`:
 *   - NO descuenta créditos (el blog es del SaaS, no del cliente).
 *   - Sube al bucket `blog` (público, indexable por Google).
 *   - Devuelve URL pública directa (no path interno).
 *
 * Tier "estandar"  → gemini-3.1-flash-image-preview (Nano Banana 2, ~$0.039)
 * Tier "pro"       → gemini-3-pro-image-preview (Nano Banana Pro, ~$0.134)
 *   Pro solo conviene para portadas con texto renderizado / layouts complejos.
 */
import crypto from "node:crypto";
import { generarImagen, type ModeloImagen } from "@/lib/imagenes/nanoBanana";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export type TierImagen = "estandar" | "pro";

export interface ImagenPortadaGenerada {
  url_publica: string;
  ruta_storage: string;
  bytes: number;
  /** Modelo Gemini usado. Ausente si la imagen fue uploaded manualmente. */
  modelo?: ModeloImagen;
}

function modeloDeTier(tier: TierImagen): ModeloImagen {
  return tier === "pro"
    ? "gemini-3-pro-image-preview"
    : "gemini-3.1-flash-image-preview";
}

/**
 * Recibe un prompt en inglés (Nano Banana funciona mejor en EN) y
 * devuelve URL pública de la imagen subida al bucket `blog`.
 *
 * Si falla la generación, lanza error — el caller decide si reintentar
 * o publicar sin portada.
 */
export async function generarImagenPortada(
  prompt: string,
  opciones?: {
    /** Slug del artículo, para nombrar el archivo de forma trazable */
    slugArticulo?: string;
    /** Tier de calidad (default "estandar" — Banana 2) */
    tier?: TierImagen;
  },
): Promise<ImagenPortadaGenerada> {
  const tier: TierImagen = opciones?.tier ?? "estandar";
  const modelo = modeloDeTier(tier);
  const { pngBytes, mimetype } = await generarImagen(prompt, undefined, {
    modelo,
  });

  // Nombre con hash para invalidar cache cuando se regenera
  const hash = crypto.randomBytes(4).toString("hex");
  const baseNombre = opciones?.slugArticulo
    ? `${opciones.slugArticulo}-${hash}`
    : `portada-${Date.now()}-${hash}`;
  const extension = mimetype.includes("png")
    ? "png"
    : mimetype.includes("webp")
      ? "webp"
      : "jpg";
  const ruta = `portadas/${baseNombre}.${extension}`;

  // Subir al bucket blog
  const supabase = crearClienteAdmin();
  const { error: errUpload } = await supabase.storage
    .from("blog")
    .upload(ruta, pngBytes, {
      contentType: mimetype,
      cacheControl: "31536000", // 1 año — la URL incluye hash, no se invalida
      upsert: false,
    });
  if (errUpload) {
    throw new Error(`[blog/imagen] no se pudo subir portada: ${errUpload.message}`);
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage.from("blog").getPublicUrl(ruta);
  if (!urlData?.publicUrl) {
    throw new Error("[blog/imagen] no se pudo obtener URL pública");
  }

  return {
    url_publica: urlData.publicUrl,
    ruta_storage: ruta,
    bytes: pngBytes.length,
    modelo,
  };
}

/**
 * Genera y sube una imagen INLINE (para insertar dentro del cuerpo
 * del artículo, no como portada). Mismo pipeline pero el archivo va
 * a la carpeta `inline/` en lugar de `portadas/`.
 *
 * Siempre usa tier "estandar" (Banana 2) — para inlines no se justifica
 * el precio de Pro: son ilustraciones contextuales, no la primera
 * impresión visual.
 */
export interface ImagenInlineGenerada {
  url_publica: string;
  ruta_storage: string;
  bytes: number;
  alt: string;
}

export async function generarImagenInline(
  prompt: string,
  altText: string,
  opciones?: { slugArticulo?: string },
): Promise<ImagenInlineGenerada> {
  const { pngBytes, mimetype } = await generarImagen(prompt, undefined, {
    modelo: "gemini-3.1-flash-image-preview",
  });

  const hash = crypto.randomBytes(4).toString("hex");
  const baseNombre = opciones?.slugArticulo
    ? `${opciones.slugArticulo}-inline-${hash}`
    : `inline-${Date.now()}-${hash}`;
  const extension = mimetype.includes("png")
    ? "png"
    : mimetype.includes("webp")
      ? "webp"
      : "jpg";
  const ruta = `inline/${baseNombre}.${extension}`;

  const supabase = crearClienteAdmin();
  const { error: errUpload } = await supabase.storage
    .from("blog")
    .upload(ruta, pngBytes, {
      contentType: mimetype,
      cacheControl: "31536000",
      upsert: false,
    });
  if (errUpload) {
    throw new Error(`[blog/imagen] no se pudo subir inline: ${errUpload.message}`);
  }

  const { data: urlData } = supabase.storage.from("blog").getPublicUrl(ruta);
  if (!urlData?.publicUrl) {
    throw new Error("[blog/imagen] no se pudo obtener URL pública de inline");
  }

  return {
    url_publica: urlData.publicUrl,
    ruta_storage: ruta,
    bytes: pngBytes.length,
    alt: altText,
  };
}

/**
 * Sube una imagen ya generada (uploaded por el admin desde el panel,
 * por ejemplo) al bucket blog y devuelve URL pública.
 */
export async function subirImagenPortadaDesdeBytes(
  bytes: Buffer,
  mimetype: string,
  opciones?: { slugArticulo?: string },
): Promise<ImagenPortadaGenerada> {
  const hash = crypto.randomBytes(4).toString("hex");
  const ext = mimetype.split("/")[1] ?? "jpg";
  const baseNombre = opciones?.slugArticulo
    ? `${opciones.slugArticulo}-${hash}`
    : `portada-${Date.now()}-${hash}`;
  const ruta = `portadas/${baseNombre}.${ext}`;

  const supabase = crearClienteAdmin();
  const { error } = await supabase.storage.from("blog").upload(ruta, bytes, {
    contentType: mimetype,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    throw new Error(`[blog/imagen] subida manual falló: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from("blog").getPublicUrl(ruta);
  if (!urlData?.publicUrl) {
    throw new Error("[blog/imagen] no se pudo obtener URL pública");
  }

  return {
    url_publica: urlData.publicUrl,
    ruta_storage: ruta,
    bytes: bytes.length,
  };
}
