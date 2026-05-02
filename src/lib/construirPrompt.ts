import type {
  Cuenta,
  EntradaConocimiento,
  MedioBiblioteca,
  Producto,
} from "./baseDatos";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";

/**
 * Combina los niveles de configuración del agente en un único system prompt:
 *
 * 1) Instrucciones base (tono, reglas, personaje): cuenta.prompt_sistema
 * 2) Texto libre del negocio: cuenta.contexto_negocio
 * 3) Entradas estructuradas (productos, FAQs, etc): conocimiento[]
 * 4) Biblioteca de medios disponibles que el agente puede enviar
 * 5) Catálogo de productos con precio y stock
 */
export function construirPromptSistema(
  cuenta: Cuenta,
  conocimiento: EntradaConocimiento[],
  biblioteca: MedioBiblioteca[] = [],
  productos: Producto[] = [],
): string {
  const partes: string[] = [];

  const promptBase = cuenta.prompt_sistema?.trim();
  partes.push(promptBase || PROMPT_SISTEMA_DEFAULT);

  const contexto = cuenta.contexto_negocio?.trim();
  if (contexto) {
    partes.push("\n\n# Información del negocio\n\n" + contexto);
  }

  const entradasValidas = conocimiento.filter(
    (e) => e.titulo.trim() && e.contenido.trim(),
  );
  if (entradasValidas.length > 0) {
    partes.push("\n\n# Información clave de referencia\n");
    for (const e of entradasValidas) {
      partes.push(`\n## ${e.titulo.trim()}\n\n${e.contenido.trim()}\n`);
    }
  }

  if (biblioteca.length > 0) {
    partes.push(
      "\n\n# Medios disponibles para enviar\n\n" +
        "Tenés estos archivos pre-cargados que podés enviar al cliente cuando " +
        "convenga. Para enviarlos, agregá una parte con tipo='media' y media_id " +
        "exactamente igual al identificador. NO inventes identificadores.\n",
    );
    for (const m of biblioteca) {
      partes.push(
        `\n- **${m.identificador}** (${m.tipo}): ${m.descripcion.trim() || "(sin descripción)"}`,
      );
    }
    partes.push("\n");
  }

  const productosActivos = productos.filter((p) => p.esta_activo);
  if (productosActivos.length > 0) {
    partes.push(
      "\n\n# Catálogo de productos\n\n" +
        "Estos son los productos que vende el negocio. Cuando el cliente " +
        "pregunte por algo, usá esta info para responder con precio, " +
        "stock y descripción reales. SI un cliente pregunta o muestra " +
        "interés en alguno (precio, info, fotos, comprar), incluí su ID " +
        "en el campo `productos_de_interes` de tu respuesta JSON. " +
        "Si está SIN stock decílo claramente y ofrecé alternativas.\n",
    );
    // Agrupar por categoría si las hay
    const porCategoria = new Map<string, Producto[]>();
    for (const p of productosActivos) {
      const cat = p.categoria?.trim() || "General";
      if (!porCategoria.has(cat)) porCategoria.set(cat, []);
      porCategoria.get(cat)!.push(p);
    }
    for (const [cat, items] of porCategoria) {
      partes.push(`\n## ${cat}\n`);
      for (const p of items) {
        const linea: string[] = [`- **${p.nombre}** (id: ${p.id})`];
        if (p.precio != null) {
          linea.push(`precio: ${p.precio} ${p.moneda}`);
        } else {
          linea.push("precio: a consultar");
        }
        if (p.stock != null) {
          linea.push(p.stock > 0 ? `stock: ${p.stock}` : "SIN STOCK");
        }
        if (p.sku) linea.push(`SKU: ${p.sku}`);
        partes.push(linea.join(" — "));
        if (p.descripcion?.trim()) {
          partes.push(`  · ${p.descripcion.trim().slice(0, 200)}`);
        }
      }
    }
    partes.push("\n");
  }

  return partes.join("");
}
