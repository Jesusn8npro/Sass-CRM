/**
 * POST /api/cron/generar-articulos
 *
 * Cron diario que genera y publica un artículo automáticamente:
 *
 *  1. Obtiene tema actual vía Perplexity (con fallback a lista curada si no hay API key).
 *  2. Genera el artículo completo con OpenAI (texto + SEO + prompts de imágenes).
 *  3. Genera imágenes: portada clickbait (tier pro) + 2 inline en el cuerpo.
 *  4. Guarda y publica el artículo directamente (sin borrador).
 *  5. Envía notificación WhatsApp al admin con el resumen del artículo.
 *
 * La categoría rota por día de la semana.
 * Protegido por header `x-cron-secret`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/logger";
import { generarArticulo } from "@/lib/blog/generador";
import { generarImagenesArticulo } from "@/lib/blog/imagenesArticulo";
import { generarSlugUnico } from "@/lib/blog/slug";
import { crearArticulo, publicarArticulo } from "@/lib/db/blog";
import { obtenerOCrearTagsPorNombres, asignarTagsAArticulo } from "@/lib/db/blogTaxonomia";
import { categoriaDeHoy, CATEGORIA_IDS, obtenerTemaActual } from "@/lib/blog/temas-perplexity";
import { obtenerOCrearConversacion } from "@/lib/db/conversaciones";
import { encolarBandejaSalida } from "@/lib/db/bandejaSalida";
import { obtenerBlogConfig, debeEjecutarAhora } from "@/lib/db/blogConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const ADMIN_CUENTA_ID = process.env.ADMIN_NOTIFY_CUENTA_ID ?? "87d27b40-b7c5-4bd7-9ab6-a5e44790eeac";
const ADMIN_PHONE     = process.env.ADMIN_NOTIFY_PHONE     ?? "573123790071";

async function notificarAdmin(titulo: string, resumen: string, slug: string, categoria: string): Promise<void> {
  try {
    const url = process.env.PUBLIC_URL ?? "";
    const urlArticulo = `${url}/blog/${slug}`;
    const mensaje =
      `📰 *Nuevo artículo publicado automáticamente*\n\n` +
      `*${titulo}*\n\n` +
      `${resumen}\n\n` +
      `🏷 Categoría: ${categoria}\n` +
      `🔗 ${urlArticulo}`;

    const conv = await obtenerOCrearConversacion(ADMIN_CUENTA_ID, ADMIN_PHONE, "Admin");
    await encolarBandejaSalida(ADMIN_CUENTA_ID, conv.id, ADMIN_PHONE, mensaje);
    log.info({ slug }, "[cron:blog] notificación WhatsApp encolada");
  } catch (err) {
    log.warn({ err }, "[cron:blog] falló notificación WhatsApp (no crítico)");
  }
}

export async function POST(request: NextRequest) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) {
    log.warn("[cron:blog] CRON_SECRET no configurada");
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 500 });
  }
  if (request.headers.get("x-cron-secret") !== esperado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // ── 0. Verificar configuración de horario ────────────────────────────────
  let config;
  try {
    config = await obtenerBlogConfig();
  } catch (err) {
    log.warn({ err }, "[cron:blog] no se pudo leer blog_config, usando defaults");
    config = null;
  }

  if (config && !debeEjecutarAhora(config)) {
    const horaUTC = new Date().getUTCHours();
    const diaUTC = new Date().getUTCDay();
    log.info({ horaUTC, diaUTC, horas: config.horas, dias: config.dias_semana }, "[cron:blog] fuera de horario configurado, saltando");
    return NextResponse.json({ ok: true, saltado: true, motivo: "fuera_de_horario" });
  }

  const inicio = Date.now();
  const categoria = categoriaDeHoy();
  const categoriaId = CATEGORIA_IDS[categoria];
  const longitud = (config?.longitud ?? "medio") as "corto" | "medio" | "largo";
  const tierPortada = (config?.tier_portada ?? "pro") as "pro" | "estandar";
  const modoImagenes = (config?.modo_imagenes ?? "completo") as "sin-imagenes" | "solo-portada" | "completo";

  log.info({ categoria, longitud, tierPortada, modoImagenes }, "[cron:blog] iniciando generación");

  // ── 1. Obtener tema ───────────────────────────────────────────────────────
  const { tema, contexto_adicional, fuente } = await obtenerTemaActual(categoria);
  log.info({ tema, fuente }, "[cron:blog] tema obtenido");

  const temaCompleto = contexto_adicional
    ? `${tema}\n\nContexto actual: ${contexto_adicional}`
    : tema;

  // ── 2. Generar artículo con OpenAI ────────────────────────────────────────
  const t0Contenido = Date.now();
  let generado;
  try {
    generado = await generarArticulo({
      tema: temaCompleto,
      categoria,
      longitud,
      audiencia: "dueños de PYMEs y emprendedores en Latinoamérica",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg, tema }, "[cron:blog] falló generación de contenido");
    return NextResponse.json({ error: "Falló generarArticulo", detalle: msg }, { status: 500 });
  }
  const msContenido = Date.now() - t0Contenido;

  // ── 3. Slug único ─────────────────────────────────────────────────────────
  const slug = await generarSlugUnico(generado.slug_sugerido);

  // ── 4. Imágenes (portada pro + 2 inline) ──────────────────────────────────
  const t0Imagenes = Date.now();
  let imgs;
  try {
    imgs = await generarImagenesArticulo(generado, slug, modoImagenes, tierPortada);
  } catch (err) {
    log.warn({ err }, "[cron:blog] falló imágenes, continuando sin ellas");
    imgs = {
      portada: null,
      inlines: [],
      contenido_md_final: generado.contenido_md,
      inlines_sugeridas: 0,
      inlines_planificadas: 0,
    };
  }
  const msImagenes = Date.now() - t0Imagenes;

  // ── 5. Guardar en DB ──────────────────────────────────────────────────────
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

  // ── 6. Tags ───────────────────────────────────────────────────────────────
  if (generado.tags_sugeridos.length > 0) {
    try {
      const tags = await obtenerOCrearTagsPorNombres(generado.tags_sugeridos);
      if (tags.length > 0) {
        await asignarTagsAArticulo(articulo.id, tags.map((t) => t.id));
      }
    } catch (err) {
      log.warn({ err }, "[cron:blog] tags fallaron (no crítico)");
    }
  }

  // ── 7. Publicar ───────────────────────────────────────────────────────────
  await publicarArticulo(articulo.id);

  // ── 8. Notificar al admin por WhatsApp ────────────────────────────────────
  await notificarAdmin(generado.titulo, generado.resumen, slug, categoria);

  const ms = Date.now() - inicio;
  log.info(
    { slug, categoria, fuente, msContenido, msImagenes, ms, portada: !!imgs.portada, inlines: imgs.inlines.length },
    "[cron:blog] artículo publicado",
  );

  return NextResponse.json({
    ok: true,
    slug,
    titulo: generado.titulo,
    categoria,
    fuente_tema: fuente,
    portada: !!imgs.portada,
    inlines_generadas: imgs.inlines.length,
    ms_contenido: msContenido,
    ms_imagenes: msImagenes,
    ms_total: ms,
  });
}
