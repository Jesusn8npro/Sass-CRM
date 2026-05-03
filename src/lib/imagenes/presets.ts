/**
 * Presets de generación de imágenes para productos. El usuario elige
 * uno desde la UI, sin escribir un prompt complejo.
 *
 * El prompt es lo que se le pasa a Nano Banana / Flux. Está pensado
 * para image-to-image: la imagen original del producto + estas
 * instrucciones para mantenerlo consistente.
 */

export interface PresetImagen {
  id: string;
  etiqueta: string;
  descripcion: string;
  emoji: string;
  prompt: string;
}

export const PRESETS_IMAGEN: PresetImagen[] = [
  {
    id: "fondo_blanco",
    etiqueta: "Fondo blanco e-commerce",
    descripcion: "Foto limpia con fondo blanco profesional, lista para tienda online.",
    emoji: "⬜",
    prompt:
      "Producto sobre fondo blanco puro estilo e-commerce profesional. " +
      "Iluminación de estudio, sombra suave abajo, sin texto, sin logos, " +
      "sin marca de agua. Conservar el producto idéntico al original — " +
      "mismos colores, mismo material, misma forma. Calidad fotográfica.",
  },
  {
    id: "lifestyle",
    etiqueta: "Foto lifestyle",
    descripcion: "El producto en uso, en un ambiente real y cálido.",
    emoji: "📸",
    prompt:
      "Foto lifestyle del mismo producto en un ambiente real y cálido " +
      "(escritorio de madera con luz natural, taza de café al lado). " +
      "Conservar el producto idéntico — mismos colores, materiales y " +
      "forma. Sin texto, sin logos, sin marca de agua. Foto natural, " +
      "no parecer renderizado.",
  },
  {
    id: "fondo_oscuro",
    etiqueta: "Fondo oscuro premium",
    descripcion: "Estética dramática para productos de gama alta.",
    emoji: "🖤",
    prompt:
      "Producto sobre fondo oscuro degradado (negro a gris muy oscuro), " +
      "iluminación dramática lateral, estilo fotografía de producto premium. " +
      "Conservar el producto idéntico al original. Sin texto, sin logos, " +
      "sin marca de agua.",
  },
  {
    id: "redes_sociales",
    etiqueta: "Cuadrado para redes sociales",
    descripcion: "Composición 1:1 con espacio negativo para texto en Canva.",
    emoji: "📱",
    prompt:
      "Composición cuadrada 1:1 con el producto al lado izquierdo y " +
      "espacio negativo limpio a la derecha (donde el usuario podrá poner " +
      "texto en Canva después). Fondo de color sólido suave (beige, " +
      "verde menta o rosa pastel). Iluminación de estudio. Sin texto, " +
      "sin logos.",
  },
  {
    id: "vista_frontal",
    etiqueta: "Vista frontal limpia",
    descripcion: "Tomada de frente perfectamente centrada, ideal para fichas.",
    emoji: "🎯",
    prompt:
      "Vista frontal del producto perfectamente centrada y nivelada, " +
      "fondo blanco neutro, sin sombras duras, conservando proporciones " +
      "exactas. Estilo catálogo de producto. Sin texto, sin logos.",
  },
];

export function obtenerPreset(id: string): PresetImagen | null {
  return PRESETS_IMAGEN.find((p) => p.id === id) ?? null;
}
