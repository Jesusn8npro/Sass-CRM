/**
 * GET  /api/admin/blog/articulos  — listado (con filtros)
 * POST /api/admin/blog/articulos  — crear artículo manual
 */
import { NextRequest, NextResponse } from "next/server";
import { requerirSuperAdmin } from "@/lib/admin/sesion";
import {
  crearArticulo,
  listarTodosLosArticulos,
  registrarAccionAdmin,
  type EstadoArticulo,
} from "@/lib/baseDatos";
import { generarSlugUnico } from "@/lib/blog/slug";
import { calcularTiempoLectura } from "@/lib/blog/markdown";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;

  const { searchParams } = new URL(req.url);
  const estadoRaw = searchParams.get("estado");
  const estado = (
    estadoRaw === "borrador" || estadoRaw === "publicado" || estadoRaw === "archivado"
      ? estadoRaw
      : undefined
  ) as EstadoArticulo | undefined;

  try {
    const articulos = await listarTodosLosArticulos({ estado, limite: 200 });
    return NextResponse.json({ articulos });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON válido" }, { status: 400 });
  }

  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const resumen = typeof body.resumen === "string" ? body.resumen.trim() : "";
  const contenido_md =
    typeof body.contenido_md === "string" ? body.contenido_md : "";

  if (titulo.length < 5)
    return NextResponse.json({ error: "Título muy corto (mínimo 5)" }, { status: 400 });
  if (resumen.length < 30)
    return NextResponse.json({ error: "Resumen muy corto (mínimo 30)" }, { status: 400 });
  if (contenido_md.length < 100)
    return NextResponse.json({ error: "Contenido muy corto (mínimo 100)" }, { status: 400 });

  try {
    const slug = await generarSlugUnico(titulo);
    const tiempo = calcularTiempoLectura(contenido_md);
    const articulo = await crearArticulo({
      slug,
      titulo,
      resumen,
      contenido_md,
      categoria_id: (body.categoria_id as string) || null,
      imagen_portada_url: (body.imagen_portada_url as string) || null,
      imagen_portada_alt: (body.imagen_portada_alt as string) || null,
      seo_titulo: (body.seo_titulo as string) || null,
      seo_descripcion: (body.seo_descripcion as string) || null,
      seo_keywords: Array.isArray(body.seo_keywords)
        ? (body.seo_keywords as string[])
        : [],
      autor_nombre: (body.autor_nombre as string) || sesion.email,
      autor_email: sesion.email,
      tiempo_lectura_min: tiempo,
      generado_por: "humano",
    });

    void registrarAccionAdmin({
      superAdminId: sesion.superAdmin.id,
      origen: "panel",
      accion: "blog_articulo_crear",
      payload: { articulo_id: articulo.id, slug: articulo.slug },
    });

    return NextResponse.json({ articulo }, { status: 201 });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
