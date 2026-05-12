/**
 * Inserta imágenes inline dentro del markdown del artículo.
 *
 * Estrategia: las imágenes se ubican DESPUÉS del párrafo siguiente al
 * encabezado H2 indicado (1-indexed). Esto rompe el bloque de texto
 * temprano y mantiene a Google contento con señales visuales que
 * aumentan tiempo en página y CTR de miniaturas.
 *
 * Si el `despues_de_h2_numero` solicitado supera la cantidad de H2 en
 * el documento, la imagen se omite (no la metemos al final porque ahí
 * va el CTA y la rompería). Esto es defensivo — el modelo a veces
 * sugiere H2 inexistentes.
 *
 * Formato de inserción: línea en blanco + `![alt](url)` + línea en
 * blanco. Markdown estándar, sin caption. El alt text es crítico para
 * SEO y accesibilidad.
 */

export interface ImagenInlineParaInsertar {
  url: string;
  alt: string;
  /** 1-indexed: 1 = después del primer H2, 2 = después del segundo, etc. */
  despues_de_h2_numero: number;
}

/**
 * Recibe el markdown crudo y las imágenes a insertar, devuelve un
 * markdown nuevo con las imágenes intercaladas. Si no hay imágenes,
 * devuelve el markdown sin cambios.
 *
 * Algoritmo:
 *  1. Splittea por líneas.
 *  2. Identifica los índices de cada H2 (líneas que empiezan con `## `).
 *  3. Para cada imagen ordenada por `despues_de_h2_numero` desc, ubica
 *     el H2 correspondiente, encuentra el FIN del primer párrafo
 *     después de ese H2, e inserta la imagen ahí.
 *  4. Procesa de mayor a menor para que los índices no se corran.
 */
export function insertarImagenesEnMarkdown(
  contenidoMd: string,
  imagenes: ImagenInlineParaInsertar[],
): string {
  if (!imagenes.length) return contenidoMd;

  const lineas = contenidoMd.split("\n");

  // Mapeo: número de H2 (1-indexed) → índice de línea del H2
  const indicesH2: number[] = [];
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i] ?? "";
    if (linea.startsWith("## ") && !linea.startsWith("### ")) {
      indicesH2.push(i);
    }
  }

  // Ordeno descendente por número de H2 para que insertar al final no
  // corra los índices de los inserts anteriores.
  const ordenadas = [...imagenes].sort(
    (a, b) => b.despues_de_h2_numero - a.despues_de_h2_numero,
  );

  let resultado = [...lineas];
  for (const img of ordenadas) {
    const idxH2 = indicesH2[img.despues_de_h2_numero - 1];
    if (idxH2 === undefined) continue; // H2 inexistente, skip silencioso

    // Buscar el fin del primer párrafo después del H2. Un "fin de
    // párrafo" es una línea vacía o el inicio de otro bloque (otro
    // encabezado, lista, etc).
    const idxInsercion = encontrarFinDePrimerParrafo(resultado, idxH2);
    const bloqueImagen = ["", `![${escaparAltMd(img.alt)}](${img.url})`, ""];
    resultado = [
      ...resultado.slice(0, idxInsercion),
      ...bloqueImagen,
      ...resultado.slice(idxInsercion),
    ];
  }

  return resultado.join("\n");
}

function encontrarFinDePrimerParrafo(
  lineas: string[],
  idxH2: number,
): number {
  // Saltar el H2 mismo y cualquier línea vacía inmediata después.
  let i = idxH2 + 1;
  while (i < lineas.length && (lineas[i] ?? "").trim() === "") i++;

  // Avanzar mientras estemos dentro de un párrafo de texto plano.
  while (i < lineas.length) {
    const linea = lineas[i] ?? "";
    if (linea.trim() === "") return i; // fin del párrafo: línea vacía
    if (linea.startsWith("#")) return i; // otro encabezado, no metemos en medio
    if (/^[-*+]\s/.test(linea)) return i; // inicio de lista
    if (/^\d+\.\s/.test(linea)) return i; // lista numerada
    if (linea.startsWith("```")) return i; // bloque de código
    i++;
  }

  // Llegamos al final del documento sin cortar — insertamos al final.
  return lineas.length;
}

/**
 * Escapa caracteres problemáticos del alt text dentro de
 * `![alt](url)`. Los `]` rompen el enlace si quedan sueltos.
 */
function escaparAltMd(alt: string): string {
  return alt.replace(/\]/g, "\\]").replace(/\[/g, "\\[").trim();
}
