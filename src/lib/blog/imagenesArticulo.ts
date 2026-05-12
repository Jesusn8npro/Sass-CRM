/**
 * Orquestador de imágenes de un artículo de blog.
 *
 * Recibe el artículo ya generado (texto + prompts sugeridos) + el modo
 * elegido por el admin, y materializa las imágenes en paralelo: portada
 * (siempre) + 0-2 inlines según modo y heurística.
 *
 * Modos:
 *   - "auto"          → heurística: portada siempre + inlines según largo
 *   - "solo-portada"  → solo portada (modo económico)
 *   - "completo"      → portada + las 2 inlines sugeridas
 *   - "sin-imagenes"  → cero imágenes (testing / borradores rápidos)
 *
 * Heurística "auto":
 *   - <1500 palabras → solo portada
 *   - 1500-2500      → portada + 1 inline (primera sugerida)
 *   - >2500          → portada + 2 inlines
 *
 * Errores: cada imagen falla aislada (Promise.allSettled). Si la portada
 * falla, devolvemos null y el artículo se publica sin portada (igual que
 * el comportamiento previo). Si una inline falla, las otras igual van.
 */
import {
  generarImagenPortada,
  generarImagenInline,
  type ImagenPortadaGenerada,
  type ImagenInlineGenerada,
  type TierImagen,
} from "./imagen";
import {
  insertarImagenesEnMarkdown,
  type ImagenInlineParaInsertar,
} from "./insertarImagenes";
import type { ArticuloGenerado } from "./generador";

export type ModoImagenes = "auto" | "solo-portada" | "completo" | "sin-imagenes";

export interface ResultadoImagenesArticulo {
  /** URL pública de la portada, o null si falló o el modo no la incluye */
  portada: ImagenPortadaGenerada | null;
  /** Imágenes inline que se materializaron (vacío si modo no las incluye). */
  inlines: ImagenInlineGenerada[];
  /** Markdown del artículo con las imágenes inline ya insertadas. */
  contenido_md_final: string;
  /** Cuántas imágenes inline el modelo sugirió originalmente (para metrics). */
  inlines_sugeridas: number;
  /** Cuántas inline se decidió generar según modo + heurística. */
  inlines_planificadas: number;
}

function contarPalabras(texto: string): number {
  return (texto.match(/\S+/g) ?? []).length;
}

/**
 * Decide cuántas inlines materializar según el modo + cantidad sugerida
 * por el modelo + largo del artículo.
 */
function decidirCantidadInlines(
  modo: ModoImagenes,
  sugeridas: number,
  palabras: number,
): number {
  if (modo === "sin-imagenes" || modo === "solo-portada") return 0;
  if (sugeridas === 0) return 0;
  if (modo === "completo") return Math.min(sugeridas, 2);
  // modo "auto" — heurística por largo
  if (palabras < 1500) return 0;
  if (palabras < 2500) return Math.min(sugeridas, 1);
  return Math.min(sugeridas, 2);
}

/**
 * Genera todas las imágenes del artículo y devuelve el markdown final
 * con las inline ya insertadas.
 *
 * Parámetros:
 *  - articulo: el output de `generarArticulo()` (texto + prompts).
 *  - slug: el slug definitivo (para naming trazable de archivos).
 *  - modo: cómo manejar imágenes (default "auto").
 *  - tierPortada: "estandar" (Banana 2, ~$0.039) o "pro" (~$0.134).
 */
export async function generarImagenesArticulo(
  articulo: ArticuloGenerado,
  slug: string,
  modo: ModoImagenes = "auto",
  tierPortada: TierImagen = "estandar",
): Promise<ResultadoImagenesArticulo> {
  const palabras = contarPalabras(articulo.contenido_md);
  const sugeridas = articulo.imagenes_inline_sugeridas.length;
  const planificadas = decidirCantidadInlines(modo, sugeridas, palabras);
  const incluyePortada = modo !== "sin-imagenes";

  // Tareas en paralelo: portada + N inlines.
  const tareas: Promise<unknown>[] = [];

  const tareaPortada: Promise<ImagenPortadaGenerada | null> = incluyePortada
    ? generarImagenPortada(articulo.imagen_prompt_sugerido, {
        slugArticulo: slug,
        tier: tierPortada,
      }).catch((err) => {
        console.warn("[imagenesArticulo] portada falló:", err);
        return null;
      })
    : Promise.resolve(null);
  tareas.push(tareaPortada);

  const inlinesParaGenerar = articulo.imagenes_inline_sugeridas.slice(
    0,
    planificadas,
  );
  const tareasInlines: Promise<
    { ok: true; imagen: ImagenInlineGenerada; despues_de_h2_numero: number }
    | { ok: false }
  >[] = inlinesParaGenerar.map((sug) =>
    generarImagenInline(sug.prompt, sug.alt_text, { slugArticulo: slug })
      .then(
        (imagen) =>
          ({
            ok: true as const,
            imagen,
            despues_de_h2_numero: sug.despues_de_h2_numero,
          }),
      )
      .catch((err) => {
        console.warn(
          `[imagenesArticulo] inline #${sug.despues_de_h2_numero} falló:`,
          err,
        );
        return { ok: false as const };
      }),
  );
  tareas.push(...tareasInlines);

  await Promise.all(tareas);

  const portada = await tareaPortada;
  const resultadosInlines = await Promise.all(tareasInlines);

  const inlinesOk = resultadosInlines
    .filter(
      (r): r is { ok: true; imagen: ImagenInlineGenerada; despues_de_h2_numero: number } =>
        r.ok,
    );

  const paraInsertar: ImagenInlineParaInsertar[] = inlinesOk.map((r) => ({
    url: r.imagen.url_publica,
    alt: r.imagen.alt,
    despues_de_h2_numero: r.despues_de_h2_numero,
  }));

  const contenidoFinal = insertarImagenesEnMarkdown(
    articulo.contenido_md,
    paraInsertar,
  );

  return {
    portada,
    inlines: inlinesOk.map((r) => r.imagen),
    contenido_md_final: contenidoFinal,
    inlines_sugeridas: sugeridas,
    inlines_planificadas: planificadas,
  };
}
