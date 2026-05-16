/**
 * GET  /api/admin/blog/categorias — listar todas
 * POST /api/admin/blog/categorias — crear nueva
 */
import { NextRequest, NextResponse } from "next/server";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";
import { crearCategoria, listarCategorias } from "@/lib/baseDatos";
import { slugificar } from "@/lib/blog/slug";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const categorias = await listarCategorias();
    return NextResponse.json({ categorias });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await parsearJSON<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (nombre.length < 2)
    return NextResponse.json({ error: "Nombre muy corto" }, { status: 400 });

  const slug =
    (typeof body.slug === "string" && body.slug.trim()) || slugificar(nombre);

  try {
    const categoria = await crearCategoria({
      slug,
      nombre,
      descripcion: (body.descripcion as string) || null,
      orden: typeof body.orden === "number" ? body.orden : 99,
    });
    return NextResponse.json({ categoria }, { status: 201 });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: detalle }, { status: 500 });
  }
}
