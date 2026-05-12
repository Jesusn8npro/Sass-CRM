/**
 * GET    /api/admin/blog/articulos/[id]
 * PATCH  /api/admin/blog/articulos/[id]
 * DELETE /api/admin/blog/articulos/[id]
 *
 * También soporta acciones especiales via PATCH:
 *   { accion: "publicar" }  → publica el borrador
 *   { accion: "archivar" }  → archiva (saca del index público)
 */
import { NextRequest, NextResponse } from "next/server";
import { requerirSuperAdmin } from "@/lib/admin/sesion";
import {
  actualizarArticulo,
  archivarArticulo,
  eliminarArticulo,
  obtenerArticuloPorId,
  publicarArticulo,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { calcularTiempoLectura } from "@/lib/blog/markdown";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;
  const { id } = await ctx.params;
  const articulo = await obtenerArticuloPorId(id);
  if (!articulo) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ articulo });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }

  try {
    // Acciones especiales
    if (body.accion === "publicar") {
      const articulo = await publicarArticulo(id);
      void registrarAccionAdmin({
        superAdminId: sesion.superAdmin.id,
        origen: "panel",
        accion: "blog_articulo_publicar",
        payload: { articulo_id: id },
      });
      return NextResponse.json({ articulo });
    }
    if (body.accion === "archivar") {
      await archivarArticulo(id);
      void registrarAccionAdmin({
        superAdminId: sesion.superAdmin.id,
        origen: "panel",
        accion: "blog_articulo_archivar",
        payload: { articulo_id: id },
      });
      return NextResponse.json({ ok: true });
    }

    // Update normal de campos
    const cambios: Record<string, unknown> = {};
    if (typeof body.titulo === "string") cambios.titulo = body.titulo.trim();
    if (typeof body.resumen === "string") cambios.resumen = body.resumen.trim();
    if (typeof body.contenido_md === "string") {
      cambios.contenido_md = body.contenido_md;
      cambios.tiempo_lectura_min = calcularTiempoLectura(body.contenido_md);
    }
    if (typeof body.imagen_portada_url === "string" || body.imagen_portada_url === null)
      cambios.imagen_portada_url = body.imagen_portada_url;
    if (typeof body.imagen_portada_alt === "string" || body.imagen_portada_alt === null)
      cambios.imagen_portada_alt = body.imagen_portada_alt;
    if (typeof body.seo_titulo === "string" || body.seo_titulo === null)
      cambios.seo_titulo = body.seo_titulo;
    if (typeof body.seo_descripcion === "string" || body.seo_descripcion === null)
      cambios.seo_descripcion = body.seo_descripcion;
    if (Array.isArray(body.seo_keywords))
      cambios.seo_keywords = body.seo_keywords;
    if (typeof body.categoria_id === "string" || body.categoria_id === null)
      cambios.categoria_id = body.categoria_id;

    const articulo = await actualizarArticulo(id, cambios);
    if (!articulo) return NextResponse.json({ error: "No existe" }, { status: 404 });

    void registrarAccionAdmin({
      superAdminId: sesion.superAdmin.id,
      origen: "panel",
      accion: "blog_articulo_editar",
      payload: { articulo_id: id, campos: Object.keys(cambios) },
    });
    return NextResponse.json({ articulo });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;
  const { id } = await ctx.params;
  try {
    await eliminarArticulo(id);
    void registrarAccionAdmin({
      superAdminId: sesion.superAdmin.id,
      origen: "panel",
      accion: "blog_articulo_eliminar",
      payload: { articulo_id: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
