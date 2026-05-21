/**
 * DAO de categorías y tags del blog.
 *
 * Quedan separados de `blog.ts` para no superar 300 líneas y porque
 * la taxonomía cambia con menos frecuencia que los artículos.
 */
import { db, lanzar } from "./cliente";

export interface CategoriaBlog {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  orden: number;
  creado_en: string;
}

export interface TagBlog {
  id: string;
  slug: string;
  nombre: string;
  creado_en: string;
}

// ============================================================
// Categorías (lectura pública vía RLS)
// ============================================================

export async function listarCategorias(): Promise<CategoriaBlog[]> {
  const { data, error } = await db()
    .from("categorias_blog")
    .select("*")
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) lanzar(error, "listarCategorias");
  return (data ?? []) as CategoriaBlog[];
}

export async function obtenerCategoriaPorSlug(
  slug: string,
): Promise<CategoriaBlog | null> {
  const { data, error } = await db()
    .from("categorias_blog")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) lanzar(error, "obtenerCategoriaPorSlug");
  return (data as CategoriaBlog) ?? null;
}

export async function crearCategoria(params: {
  slug: string;
  nombre: string;
  descripcion?: string | null;
  imagen_url?: string | null;
  orden?: number;
}): Promise<CategoriaBlog> {
  const { data, error } = await db()
    .from("categorias_blog")
    .insert({
      slug: params.slug,
      nombre: params.nombre,
      descripcion: params.descripcion ?? null,
      imagen_url: params.imagen_url ?? null,
      orden: params.orden ?? 99,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearCategoria");
  return data as CategoriaBlog;
}

// ============================================================
// Tags
// ============================================================

export async function listarTags(): Promise<TagBlog[]> {
  const { data, error } = await db()
    .from("tags_blog")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) lanzar(error, "listarTags");
  return (data ?? []) as TagBlog[];
}

export async function obtenerOCrearTagsPorNombres(
  nombres: string[],
): Promise<TagBlog[]> {
  const unicos = Array.from(
    new Set(
      nombres
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && n.length <= 80),
    ),
  );
  if (unicos.length === 0) return [];

  const resultados: TagBlog[] = [];
  for (const nombre of unicos) {
    const slug = slugifyTag(nombre);
    // Intentar buscar primero
    const { data: existente } = await db()
      .from("tags_blog")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (existente) {
      resultados.push(existente as TagBlog);
      continue;
    }
    // Crear si no existe
    const { data: nuevo, error } = await db()
      .from("tags_blog")
      .insert({ slug, nombre })
      .select()
      .single();
    if (error) {
      // Race condition: alguien lo creó en paralelo — buscar de nuevo
      const { data: reintento } = await db()
        .from("tags_blog")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (reintento) resultados.push(reintento as TagBlog);
      else console.error("[blog] no se pudo crear tag", slug, error);
      continue;
    }
    resultados.push(nuevo as TagBlog);
  }
  return resultados;
}

function slugifyTag(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ============================================================
// Relación articulo ↔ tags (M:N)
// ============================================================

export async function asignarTagsAArticulo(
  articuloId: string,
  tagsIds: string[],
): Promise<void> {
  if (tagsIds.length === 0) {
    // Borrar todos los tags si pasan array vacío
    await db().from("articulo_tags").delete().eq("articulo_id", articuloId);
    return;
  }
  // Borrar relaciones viejas que ya no están
  await db()
    .from("articulo_tags")
    .delete()
    .eq("articulo_id", articuloId)
    .not("tag_id", "in", tagsIds);
  // Insertar las nuevas (ON CONFLICT DO NOTHING vía upsert)
  const filas = tagsIds.map((tagId) => ({
    articulo_id: articuloId,
    tag_id: tagId,
  }));
  const { error } = await db().from("articulo_tags").upsert(filas, {
    onConflict: "articulo_id,tag_id",
    ignoreDuplicates: true,
  });
  if (error) lanzar(error, "asignarTagsAArticulo");
}

export async function listarTagsDeArticulo(
  articuloId: string,
): Promise<TagBlog[]> {
  const { data, error } = await db()
    .from("articulo_tags")
    .select("tags_blog:tag_id(*)")
    .eq("articulo_id", articuloId);
  if (error) lanzar(error, "listarTagsDeArticulo");
  const arr = (data ?? []) as Array<{ tags_blog: TagBlog | TagBlog[] | null }>;
  return arr
    .map((r) => (Array.isArray(r.tags_blog) ? r.tags_blog[0] : r.tags_blog))
    .filter((t): t is TagBlog => !!t);
}
