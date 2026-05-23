import { log } from "@/lib/logger";
import { generarArticulo } from "@/lib/blog/generador";
import { generarImagenesArticulo } from "@/lib/blog/imagenesArticulo";
import { generarSlugUnico } from "@/lib/blog/slug";
import { crearArticulo, publicarArticulo } from "@/lib/db/blog";
import { obtenerOCrearTagsPorNombres, asignarTagsAArticulo } from "@/lib/db/blogTaxonomia";
import { categoriaDeHoy, CATEGORIA_IDS, obtenerTemaActual, type CategoriaSlug } from "@/lib/blog/temas-perplexity";
import { obtenerOCrearConversacion } from "@/lib/db/conversaciones";
import { encolarBandejaSalida } from "@/lib/db/bandejaSalida";

export interface OpcionesGeneracion {
  longitud: "corto" | "medio" | "largo";
  tierPortada: "pro" | "estandar";
  modoImagenes: "sin-imagenes" | "solo-portada" | "completo";
  temaManual?: string;
}

export interface ResultadoGeneracion {
  ok: true;
  slug: string;
  titulo: string;
  categoria: string;
  fuente_tema: string;
  portada: boolean;
  inlines_generadas: number;
  ms_contenido: number;
  ms_imagenes: number;
  ms_total: number;
}

async function notificarAdmin(titulo: string, resumen: string, slug: string, categoria: string): Promise<void> {
  try {
    const url = process.env.PUBLIC_URL ?? "";
    const mensaje =
      `📰 *Nuevo artículo publicado automáticamente*\n\n` +
      `*${titulo}*\n\n` +
      `${resumen}\n\n` +
      `🏷 Categoría: ${categoria}\n` +
      `🔗 ${url}/blog/${slug}`;

    const cuentaId = process.env.ADMIN_NOTIFY_CUENTA_ID ?? "87d27b40-b7c5-4bd7-9ab6-a5e44790eeac";
    const phone = process.env.ADMIN_NOTIFY_PHONE ?? "573123790071";
    const conv = await obtenerOCrearConversacion(cuentaId, phone, "Admin");
    await encolarBandejaSalida(cuentaId, conv.id, phone, mensaje);
    log.info({ slug }, "[blog] notificación WhatsApp encolada");
  } catch (err) {
    log.warn({ err }, "[blog] falló notificación WhatsApp (no crítico)");
  }
}

export async function ejecutarGeneracionBlog(opciones: OpcionesGeneracion): Promise<ResultadoGeneracion> {
  const { longitud, tierPortada, modoImagenes, temaManual } = opciones;
  const inicio = Date.now();
  const categoriaHoy = categoriaDeHoy();

  log.info({ categoriaHoy, longitud, tierPortada, modoImagenes, temaManual: !!temaManual }, "[blog] iniciando generación");

  // 1. Tema: manual (admin lo especificó) o Perplexity/fallback
  let tema: string;
  let contexto_adicional: string;
  let fuente: string;

  if (temaManual?.trim()) {
    tema = temaManual.trim();
    contexto_adicional = "";
    fuente = "manual";
    log.info({ tema }, "[blog] usando tema manual del admin");
  } else {
    const resultado = await obtenerTemaActual(categoriaHoy);
    tema = resultado.tema;
    contexto_adicional = resultado.contexto_adicional;
    fuente = resultado.fuente;
    log.info({ tema, fuente }, "[blog] tema obtenido");
  }

  const temaCompleto = contexto_adicional ? `${tema}\n\nContexto actual: ${contexto_adicional}` : tema;

  // 2. Artículo — OpenAI elige la categoría más apropiada para el tema
  const t0Contenido = Date.now();
  const generado = await generarArticulo({
    tema: temaCompleto,
    categoria: categoriaHoy,
    longitud,
    audiencia: "dueños de PYMEs y emprendedores en Latinoamérica",
  });
  const msContenido = Date.now() - t0Contenido;

  // Usar la categoría que OpenAI sugirió (más precisa que la rotación por día)
  const categoriaFinal: CategoriaSlug =
    (generado.categoria_sugerida as CategoriaSlug) ?? categoriaHoy;
  const categoriaId = CATEGORIA_IDS[categoriaFinal];
  log.info({ categoriaHoy, categoriaFinal }, "[blog] categoría seleccionada");

  // 3. Slug
  const slug = await generarSlugUnico(generado.slug_sugerido);

  // 4. Imágenes
  const t0Imagenes = Date.now();
  let imgs;
  try {
    imgs = await generarImagenesArticulo(generado, slug, modoImagenes, tierPortada);
  } catch (err) {
    log.warn({ err }, "[blog] falló imágenes, continuando sin ellas");
    imgs = { portada: null, inlines: [], contenido_md_final: generado.contenido_md };
  }
  const msImagenes = Date.now() - t0Imagenes;

  // 5. Guardar en DB
  const articulo = await crearArticulo({
    slug,
    titulo: generado.titulo,
    resumen: generado.resumen,
    contenido_md: imgs.contenido_md_final,
    categoria_id: categoriaId,
    imagen_portada_url: imgs.portada?.url_publica ?? null,
    imagen_portada_alt: imgs.portada ? generado.titulo : null,
    seo_titulo: generado.seo_titulo,
    seo_descripcion: generado.seo_descripcion,
    seo_keywords: generado.seo_keywords,
    autor_nombre: "Equipo",
    autor_email: process.env.ADMIN_EMAIL ?? "admin@saas",
    tiempo_lectura_min: generado.tiempo_lectura_min,
    generado_por: "ia",
    prompt_origen: tema,
  });

  // 6. Tags
  if (generado.tags_sugeridos.length > 0) {
    try {
      const tags = await obtenerOCrearTagsPorNombres(generado.tags_sugeridos);
      if (tags.length > 0) await asignarTagsAArticulo(articulo.id, tags.map((t) => t.id));
    } catch (err) {
      log.warn({ err }, "[blog] tags fallaron (no crítico)");
    }
  }

  // 7. Publicar
  await publicarArticulo(articulo.id);

  // 8. Notificar
  await notificarAdmin(generado.titulo, generado.resumen, slug, categoriaFinal);

  const ms = Date.now() - inicio;
  log.info(
    { slug, categoria: categoriaFinal, fuente, msContenido, msImagenes, ms, portada: !!imgs.portada, inlines: imgs.inlines.length },
    "[blog] artículo publicado",
  );

  return {
    ok: true,
    slug,
    titulo: generado.titulo,
    categoria: categoriaFinal,
    fuente_tema: fuente,
    portada: !!imgs.portada,
    inlines_generadas: imgs.inlines.length,
    ms_contenido: msContenido,
    ms_imagenes: msImagenes,
    ms_total: ms,
  };
}
