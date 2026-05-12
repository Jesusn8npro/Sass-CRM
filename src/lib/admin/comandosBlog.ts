/**
 * Handlers de los comandos blog del super-admin via WhatsApp:
 *   /post <tema>    → genera artículo IA, devuelve link al preview
 *   /borradores     → lista últimos 10 borradores
 *   /publicar <id>  → publica un borrador (acepta id completo o prefijo)
 */
import {
  listarTodosLosArticulos,
  obtenerArticuloPorId,
  obtenerOCrearTagsPorNombres,
  asignarTagsAArticulo,
  crearArticulo,
  publicarArticulo,
} from "@/lib/baseDatos";
import { generarArticulo } from "@/lib/blog/generador";
import { generarSlugUnico } from "@/lib/blog/slug";
import {
  generarImagenesArticulo,
  type ModoImagenes,
} from "@/lib/blog/imagenesArticulo";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export interface ResultadoBlog {
  respuesta: string;
  resultado: Record<string, unknown>;
}

function construirLineaImagenes(
  portadaOk: boolean,
  inlines: number,
  modo: ModoImagenes,
): string {
  if (modo === "sin-imagenes") return `🚫 Sin imágenes (modo testing)`;
  if (!portadaOk) return `⚠ Portada falló — articulo sin imagen principal`;
  if (inlines === 0) return `🎨 Portada generada ✓ (sin inlines)`;
  return `🎨 Portada + ${inlines} inline${inlines === 1 ? "" : "s"} generadas ✓`;
}

/**
 * /post <tema> — genera y guarda como borrador.
 *
 * `modoImagenes` controla cuántas imágenes acompañan al artículo:
 *   - "auto" (default)  → portada + inlines según largo (1500-2500 → 1, >2500 → 2)
 *   - "solo-portada"    → solo la portada
 *   - "completo"        → portada + las 2 inlines sugeridas por el modelo
 *   - "sin-imagenes"    → cero imágenes (testing)
 */
export async function ejecutarPostBlog(
  tema: string,
  superAdminEmail: string,
  superAdminNombre: string | null,
  modoImagenes: ModoImagenes = "auto",
): Promise<ResultadoBlog> {
  if (tema.trim().length < 5) {
    return {
      respuesta:
        "❌ El tema es muy corto. Probá:\n\n`/post Cómo usar WhatsApp Business para vender más en 2026`",
      resultado: { error: "tema_corto" },
    };
  }

  const inicio = Date.now();
  try {
    const generado = await generarArticulo({ tema, longitud: "medio" });
    const slug = await generarSlugUnico(generado.titulo);

    // Orquestador: portada + 0-2 inlines según modo. Errores aislados.
    const imgs = await generarImagenesArticulo(generado, slug, modoImagenes);
    const imagenUrl = imgs.portada?.url_publica ?? null;
    const imagenAlt = imgs.portada ? generado.titulo : null;

    const articulo = await crearArticulo({
      slug,
      titulo: generado.titulo,
      resumen: generado.resumen,
      contenido_md: imgs.contenido_md_final,
      imagen_portada_url: imagenUrl,
      imagen_portada_alt: imagenAlt,
      seo_titulo: generado.seo_titulo,
      seo_descripcion: generado.seo_descripcion,
      seo_keywords: generado.seo_keywords,
      autor_nombre: superAdminNombre ?? "Equipo",
      autor_email: superAdminEmail,
      tiempo_lectura_min: generado.tiempo_lectura_min,
      generado_por: "ia",
      prompt_origen: tema,
    });

    // Tags
    if (generado.tags_sugeridos.length > 0) {
      try {
        const tags = await obtenerOCrearTagsPorNombres(generado.tags_sugeridos);
        if (tags.length > 0) {
          await asignarTagsAArticulo(
            articulo.id,
            tags.map((t) => t.id),
          );
        }
      } catch (errTags) {
        console.warn("[comandosBlog] tags fallaron:", errTags);
      }
    }

    const ms = Date.now() - inicio;
    const previewUrl = urlAbsoluta(`/blog/${slug}`);
    const idCorto = articulo.id.slice(0, 8);

    const lineaImagenes = construirLineaImagenes(
      !!imagenUrl,
      imgs.inlines.length,
      modoImagenes,
    );

    return {
      respuesta: [
        `✅ *Artículo generado en ${(ms / 1000).toFixed(1)}s*`,
        ``,
        `📰 *${articulo.titulo}*`,
        ``,
        `${articulo.resumen}`,
        ``,
        `⏱ ${articulo.tiempo_lectura_min} min · 🔑 ${articulo.seo_keywords.slice(0, 3).join(", ")}`,
        lineaImagenes,
        ``,
        `👁 Preview: ${previewUrl}`,
        ``,
        `Para publicar:`,
        `*/publicar ${idCorto}*`,
        ``,
        `_Está como borrador — solo vos lo ves hasta publicar._`,
      ].join("\n"),
      resultado: {
        articulo_id: articulo.id,
        slug: articulo.slug,
        ms,
        tags_count: generado.tags_sugeridos.length,
        con_imagen: !!imagenUrl,
        inlines: imgs.inlines.length,
        modo_imagenes: modoImagenes,
      },
    };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return {
      respuesta: `❌ Error generando el artículo:\n\n${detalle.slice(0, 250)}`,
      resultado: { error: detalle },
    };
  }
}

/**
 * /borradores — últimos 10 borradores.
 */
export async function ejecutarBorradores(): Promise<ResultadoBlog> {
  try {
    const borradores = await listarTodosLosArticulos({
      estado: "borrador",
      limite: 10,
    });

    if (borradores.length === 0) {
      return {
        respuesta:
          "📭 *Sin borradores*\n\nGenerá uno con `/post <tema>` y aparecerá acá.",
        resultado: { count: 0 },
      };
    }

    const lineas = [`📝 *Borradores (${borradores.length})*`, ``];
    for (const a of borradores) {
      const idCorto = a.id.slice(0, 8);
      lineas.push(`*${a.titulo}*`);
      lineas.push(`  ID: \`${idCorto}\` · ${a.tiempo_lectura_min} min`);
      lineas.push(`  Publicar: /publicar ${idCorto}`);
      lineas.push("");
    }
    return {
      respuesta: lineas.join("\n").trimEnd(),
      resultado: { count: borradores.length },
    };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return {
      respuesta: `❌ Error listando borradores:\n\n${detalle.slice(0, 200)}`,
      resultado: { error: detalle },
    };
  }
}

/**
 * /publicar <id> — publica un borrador. Acepta id completo o prefijo
 * de 8 chars.
 */
export async function ejecutarPublicar(
  idOPrefijo: string,
): Promise<ResultadoBlog> {
  if (!idOPrefijo) {
    return {
      respuesta:
        "❌ Falta el ID del borrador.\n\nUsá `/publicar <id>` (el id corto que ves en `/borradores`).",
      resultado: { error: "id_faltante" },
    };
  }

  try {
    // Primero intentar como id completo (UUID)
    let articulo = await obtenerArticuloPorId(idOPrefijo);

    // Si no, buscar por prefijo en borradores
    if (!articulo) {
      const borradores = await listarTodosLosArticulos({
        estado: "borrador",
        limite: 50,
      });
      const match = borradores.find((b) => b.id.startsWith(idOPrefijo));
      if (match) {
        articulo = await obtenerArticuloPorId(match.id);
      }
    }

    if (!articulo) {
      return {
        respuesta: `❌ No se encontró el borrador con ID \`${idOPrefijo}\`.\n\nUsá /borradores para ver los disponibles.`,
        resultado: { error: "no_encontrado" },
      };
    }

    if (articulo.estado === "publicado") {
      return {
        respuesta: `⚠ Ese artículo ya está publicado.\n\n${urlAbsoluta(`/blog/${articulo.slug}`)}`,
        resultado: { ya_publicado: true, slug: articulo.slug },
      };
    }

    const publicado = await publicarArticulo(articulo.id);
    if (!publicado) {
      return {
        respuesta: "❌ No se pudo publicar (error inesperado).",
        resultado: { error: "publicar_fallo" },
      };
    }

    return {
      respuesta: [
        `✅ *Publicado*`,
        ``,
        `📰 ${publicado.titulo}`,
        ``,
        `🔗 ${urlAbsoluta(`/blog/${publicado.slug}`)}`,
        ``,
        `_Google lo va a indexar en las próximas horas (sitemap actualizado)._`,
      ].join("\n"),
      resultado: { articulo_id: publicado.id, slug: publicado.slug },
    };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return {
      respuesta: `❌ Error publicando:\n\n${detalle.slice(0, 200)}`,
      resultado: { error: detalle },
    };
  }
}
