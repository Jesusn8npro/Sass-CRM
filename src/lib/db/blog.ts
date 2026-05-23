/**
 * DAO de artículos del blog.
 *
 * - Lectura pública de artículos publicados (sirve SSG/SSR sin auth).
 * - Mutaciones via service_role en server. Las policies igual fuerzan
 *   que solo super-admins puedan escribir desde el cliente Supabase
 *   con sesión normal.
 */
import { db, lanzar } from "./cliente";

export type EstadoArticulo = "borrador" | "publicado" | "archivado";
export type GeneradoPor = "humano" | "ia" | "mixto";

export interface ArticuloBlog {
  id: string;
  cuenta_id: string | null;
  slug: string;
  titulo: string;
  resumen: string;
  contenido_md: string;
  imagen_portada_url: string | null;
  imagen_portada_alt: string | null;
  categoria_id: string | null;
  estado: EstadoArticulo;
  seo_titulo: string | null;
  seo_descripcion: string | null;
  seo_keywords: string[];
  autor_nombre: string;
  autor_email: string | null;
  tiempo_lectura_min: number;
  visualizaciones: number;
  generado_por: GeneradoPor;
  prompt_origen: string | null;
  publicado_en: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface ArticuloConCategoria extends ArticuloBlog {
  categoria_slug: string | null;
  categoria_nombre: string | null;
}

const SELECT_CON_CATEGORIA = `
  *,
  categorias_blog:categoria_id(slug, nombre)
`;

function mapearConCategoria(
  fila: ArticuloBlog & {
    categorias_blog?: { slug: string; nombre: string } | { slug: string; nombre: string }[] | null;
  },
): ArticuloConCategoria {
  const cat = Array.isArray(fila.categorias_blog)
    ? fila.categorias_blog[0]
    : fila.categorias_blog;
  return {
    ...fila,
    categoria_slug: cat?.slug ?? null,
    categoria_nombre: cat?.nombre ?? null,
  };
}

// ============================================================
// Lecturas públicas (sirven páginas SSG)
// ============================================================

export async function listarArticulosPublicados(opciones?: {
  categoriaSlug?: string;
  limite?: number;
  offset?: number;
}): Promise<ArticuloConCategoria[]> {
  const limite = Math.max(1, Math.min(100, opciones?.limite ?? 20));
  const offset = Math.max(0, opciones?.offset ?? 0);

  let q = db()
    .from("articulos_blog")
    .select(SELECT_CON_CATEGORIA)
    .eq("estado", "publicado")
    .order("publicado_en", { ascending: false, nullsFirst: false })
    .range(offset, offset + limite - 1);

  if (opciones?.categoriaSlug) {
    // Filtramos por categoría — primero traemos el id de la categoría
    const { data: cat } = await db()
      .from("categorias_blog")
      .select("id")
      .eq("slug", opciones.categoriaSlug)
      .maybeSingle();
    if (!cat) return [];
    q = q.eq("categoria_id", (cat as { id: string }).id);
  }

  const { data, error } = await q;
  if (error) lanzar(error, "listarArticulosPublicados");
  return ((data ?? []) as Parameters<typeof mapearConCategoria>[0][]).map(
    mapearConCategoria,
  );
}

export async function obtenerArticuloPorSlug(
  slug: string,
  opciones?: { incluirBorradores?: boolean },
): Promise<ArticuloConCategoria | null> {
  let q = db()
    .from("articulos_blog")
    .select(SELECT_CON_CATEGORIA)
    .eq("slug", slug);
  if (!opciones?.incluirBorradores) q = q.eq("estado", "publicado");
  const { data, error } = await q.maybeSingle();
  if (error) lanzar(error, "obtenerArticuloPorSlug");
  if (!data) return null;
  return mapearConCategoria(data as Parameters<typeof mapearConCategoria>[0]);
}

/**
 * Devuelve todos los slugs publicados — usado por `generateStaticParams`
 * en /blog/[slug] y por el sitemap.
 */
export async function listarSlugsPublicados(): Promise<
  Array<{ slug: string; actualizado_en: string }>
> {
  const { data, error } = await db()
    .from("articulos_blog")
    .select("slug, actualizado_en")
    .eq("estado", "publicado")
    .order("publicado_en", { ascending: false });
  if (error) lanzar(error, "listarSlugsPublicados");
  return (data ?? []) as Array<{ slug: string; actualizado_en: string }>;
}

export async function incrementarVisualizaciones(
  articuloId: string,
): Promise<void> {
  // RPC atómico vía SQL inline — pequeño update sin race conditions críticas.
  const { error } = await db()
    .from("articulos_blog")
    .update({ visualizaciones: (await contadorActual(articuloId)) + 1 })
    .eq("id", articuloId);
  if (error)
    console.error("[blog] no se pudo incrementar visualizaciones:", error);
}

async function contadorActual(articuloId: string): Promise<number> {
  const { data } = await db()
    .from("articulos_blog")
    .select("visualizaciones")
    .eq("id", articuloId)
    .maybeSingle();
  return (data as { visualizaciones: number } | null)?.visualizaciones ?? 0;
}

// ============================================================
// Admin (CRUD) — solo se llaman desde el server
// ============================================================

export interface ParamsCrearArticulo {
  slug: string;
  titulo: string;
  resumen: string;
  contenido_md: string;
  categoria_id?: string | null;
  imagen_portada_url?: string | null;
  imagen_portada_alt?: string | null;
  seo_titulo?: string | null;
  seo_descripcion?: string | null;
  seo_keywords?: string[];
  autor_nombre?: string;
  autor_email?: string | null;
  tiempo_lectura_min?: number;
  generado_por?: GeneradoPor;
  prompt_origen?: string | null;
  cuenta_id?: string | null;
}

export async function crearArticulo(
  params: ParamsCrearArticulo,
): Promise<ArticuloBlog> {
  const { data, error } = await db()
    .from("articulos_blog")
    .insert({
      slug: params.slug,
      titulo: params.titulo,
      resumen: params.resumen,
      contenido_md: params.contenido_md,
      categoria_id: params.categoria_id ?? null,
      imagen_portada_url: params.imagen_portada_url ?? null,
      imagen_portada_alt: params.imagen_portada_alt ?? null,
      seo_titulo: params.seo_titulo ?? null,
      seo_descripcion: params.seo_descripcion ?? null,
      seo_keywords: params.seo_keywords ?? [],
      autor_nombre: params.autor_nombre ?? "Equipo",
      autor_email: params.autor_email ?? null,
      tiempo_lectura_min: params.tiempo_lectura_min ?? 3,
      generado_por: params.generado_por ?? "humano",
      prompt_origen: params.prompt_origen ?? null,
      cuenta_id: params.cuenta_id ?? null,
      estado: "borrador",
    })
    .select()
    .single();
  if (error) lanzar(error, "crearArticulo");
  return data as ArticuloBlog;
}

export async function actualizarArticulo(
  id: string,
  cambios: Partial<ParamsCrearArticulo & { estado: EstadoArticulo }>,
): Promise<ArticuloBlog | null> {
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) {
    if (v !== undefined) limpio[k] = v;
  }
  if (Object.keys(limpio).length === 0) return obtenerArticuloPorId(id);
  const { data, error } = await db()
    .from("articulos_blog")
    .update(limpio)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarArticulo");
  return data as ArticuloBlog;
}

export async function publicarArticulo(
  id: string,
): Promise<ArticuloBlog | null> {
  const { data, error } = await db()
    .from("articulos_blog")
    .update({ estado: "publicado", publicado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "publicarArticulo");
  return data as ArticuloBlog;
}

export async function archivarArticulo(id: string): Promise<void> {
  const { error } = await db()
    .from("articulos_blog")
    .update({ estado: "archivado" })
    .eq("id", id);
  if (error) lanzar(error, "archivarArticulo");
}

export async function eliminarArticulo(id: string): Promise<void> {
  const { error } = await db().from("articulos_blog").delete().eq("id", id);
  if (error) lanzar(error, "eliminarArticulo");
}

export async function obtenerArticuloPorId(
  id: string,
): Promise<ArticuloBlog | null> {
  const { data, error } = await db()
    .from("articulos_blog")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerArticuloPorId");
  return (data as ArticuloBlog) ?? null;
}

export async function listarTodosLosArticulos(opciones?: {
  estado?: EstadoArticulo;
  generado_por?: "ia" | "humano" | "mixto";
  limite?: number;
}): Promise<ArticuloConCategoria[]> {
  const limite = Math.max(1, Math.min(500, opciones?.limite ?? 100));
  let q = db()
    .from("articulos_blog")
    .select(SELECT_CON_CATEGORIA)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (opciones?.estado) q = q.eq("estado", opciones.estado);
  if (opciones?.generado_por) q = q.eq("generado_por", opciones.generado_por);
  const { data, error } = await q;
  if (error) lanzar(error, "listarTodosLosArticulos");
  return ((data ?? []) as Parameters<typeof mapearConCategoria>[0][]).map(
    mapearConCategoria,
  );
}

export async function existeArticuloConSlug(slug: string): Promise<boolean> {
  const { data, error } = await db()
    .from("articulos_blog")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) lanzar(error, "existeArticuloConSlug");
  return !!data;
}
