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
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";
import {
  actualizarArticulo,
  archivarArticulo,
  eliminarArticulo,
  obtenerArticuloPorId,
  obtenerSuperAdminPorEmail,
  publicarArticulo,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { calcularTiempoLectura } from "@/lib/blog/markdown";
import { enviarNuevoArticuloSuscriptores } from "@/lib/emails/disparadores";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function auditar(
  email: string,
  accion: string,
  payload?: Record<string, unknown>,
) {
  const sa = await obtenerSuperAdminPorEmail(email);
  if (!sa) return;
  void registrarAccionAdmin({
    superAdminId: sa.id,
    origen: "panel",
    accion,
    payload: payload ?? null,
  });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const articulo = await obtenerArticuloPorId(id);
  if (!articulo) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return NextResponse.json({ articulo });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const body = await parsearJSON<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;

  try {
    // Acciones especiales
    if (body.accion === "publicar") {
      const articulo = await publicarArticulo(id);
      void auditar(auth.email, "blog_articulo_publicar", { articulo_id: id });
      if (articulo) {
        void enviarNuevoArticuloSuscriptores(id, articulo.titulo, articulo.resumen, articulo.slug, articulo.autor_nombre);
      }
      return NextResponse.json({ articulo });
    }
    if (body.accion === "archivar") {
      await archivarArticulo(id);
      void auditar(auth.email, "blog_articulo_archivar", { articulo_id: id });
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

    void auditar(auth.email, "blog_articulo_editar", {
      articulo_id: id,
      campos: Object.keys(cambios),
    });
    return NextResponse.json({ articulo });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  try {
    await eliminarArticulo(id);
    void auditar(auth.email, "blog_articulo_eliminar", { articulo_id: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
