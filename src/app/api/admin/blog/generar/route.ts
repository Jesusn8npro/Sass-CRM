/**
 * POST /api/admin/blog/generar
 *
 * Recibe { tema, categoria?, longitud?, generar_imagen? }, genera el
 * artículo con OpenAI, opcionalmente la portada con Nano Banana,
 * crea el artículo como BORRADOR y devuelve { articulo, preview_url }.
 *
 * No publica automáticamente — el admin revisa y publica con un click.
 */
import { NextRequest, NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import {
  crearArticulo,
  obtenerCategoriaPorSlug,
  obtenerOCrearTagsPorNombres,
  asignarTagsAArticulo,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { generarArticulo } from "@/lib/blog/generador";
import { generarSlugUnico } from "@/lib/blog/slug";
import { generarImagenPortada } from "@/lib/blog/imagen";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 min — generar + imagen puede tomar

export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }

  const tema = typeof body.tema === "string" ? body.tema.trim() : "";
  if (tema.length < 5) {
    return NextResponse.json({ error: "Tema muy corto" }, { status: 400 });
  }
  const longitud = (
    ["corto", "medio", "largo"].includes(body.longitud as string)
      ? body.longitud
      : "medio"
  ) as "corto" | "medio" | "largo";
  const categoriaSlug = typeof body.categoria === "string" ? body.categoria : undefined;
  const generarImagen = body.generar_imagen !== false; // default true

  const inicio = Date.now();
  try {
    // 1) Generar contenido
    const generado = await generarArticulo({
      tema,
      categoria: categoriaSlug,
      longitud,
    });
    const msContenido = Date.now() - inicio;

    // 2) Resolver categoría si vino slug
    let categoriaId: string | null = null;
    if (categoriaSlug) {
      const cat = await obtenerCategoriaPorSlug(categoriaSlug);
      categoriaId = cat?.id ?? null;
    }

    // 3) Slug único en DB
    const slug = await generarSlugUnico(generado.titulo);

    // 4) Generar imagen de portada (opcional, en background si falla)
    let imagen_portada_url: string | null = null;
    let imagen_portada_alt: string | null = null;
    let msImagen = 0;
    if (generarImagen) {
      const inicioImg = Date.now();
      try {
        const img = await generarImagenPortada(generado.imagen_prompt_sugerido, {
          slugArticulo: slug,
        });
        imagen_portada_url = img.url_publica;
        imagen_portada_alt = generado.titulo;
        msImagen = Date.now() - inicioImg;
      } catch (errImg) {
        console.warn("[blog/generar] imagen falló, sigo sin portada:", errImg);
      }
    }

    // 5) Crear artículo como borrador
    const articulo = await crearArticulo({
      slug,
      titulo: generado.titulo,
      resumen: generado.resumen,
      contenido_md: generado.contenido_md,
      categoria_id: categoriaId,
      imagen_portada_url,
      imagen_portada_alt,
      seo_titulo: generado.seo_titulo,
      seo_descripcion: generado.seo_descripcion,
      seo_keywords: generado.seo_keywords,
      autor_nombre: "Equipo",
      autor_email: auth.email,
      tiempo_lectura_min: generado.tiempo_lectura_min,
      generado_por: "ia",
      prompt_origen: tema,
    });

    // 6) Tags
    if (generado.tags_sugeridos.length > 0) {
      const tags = await obtenerOCrearTagsPorNombres(generado.tags_sugeridos);
      if (tags.length > 0) {
        await asignarTagsAArticulo(
          articulo.id,
          tags.map((t) => t.id),
        );
      }
    }

    // 7) Audit (solo si el admin además está en super_admins)
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "blog_generar_ia",
        payload: {
          tema,
          categoria: categoriaSlug,
          longitud,
          articulo_id: articulo.id,
        },
        resultado: {
          slug,
          ms_contenido: msContenido,
          ms_imagen: msImagen,
          tags_count: generado.tags_sugeridos.length,
        },
      });
    }

    return NextResponse.json({
      articulo,
      preview_url: urlAbsoluta(`/blog/${slug}`),
      ms_contenido: msContenido,
      ms_imagen: msImagen,
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "blog_generar_ia",
        payload: { tema },
        error: detalle.slice(0, 500),
      });
    }
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
