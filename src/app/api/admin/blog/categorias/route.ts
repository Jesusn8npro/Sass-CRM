/**
 * GET  /api/admin/blog/categorias — listar todas
 * POST /api/admin/blog/categorias — crear nueva
 */
import { NextRequest, NextResponse } from "next/server";
import { requerirSuperAdmin } from "@/lib/admin/sesion";
import { crearCategoria, listarCategorias } from "@/lib/baseDatos";
import { slugificar } from "@/lib/blog/slug";

export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;
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
  const sesion = await requerirSuperAdmin();
  if (sesion instanceof NextResponse) return sesion;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body no es JSON" }, { status: 400 });
  }

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
