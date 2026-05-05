import { NextResponse, type NextRequest } from "next/server";
import { listarUsuariosPaginado } from "@/lib/baseDatos";
import { requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/usuarios — listado paginado.
 * Query params:
 *   q            — texto de búsqueda (filtra por email)
 *   plan         — free | pro | business
 *   estado       — activo | suspendido | impago | prueba
 *   pagina       — base 1
 *   limite       — default 20
 */
export async function GET(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limite = Math.min(
    Math.max(parseInt(url.searchParams.get("limite") ?? "20", 10) || 20, 1),
    100,
  );
  const pagina = Math.max(parseInt(url.searchParams.get("pagina") ?? "1", 10) || 1, 1);
  const offset = (pagina - 1) * limite;

  const planRaw = url.searchParams.get("plan");
  const estadoRaw = url.searchParams.get("estado");

  const plan =
    planRaw === "free" || planRaw === "pro" || planRaw === "business"
      ? planRaw
      : undefined;
  const estadoBilling =
    estadoRaw === "activo" ||
    estadoRaw === "suspendido" ||
    estadoRaw === "impago" ||
    estadoRaw === "prueba"
      ? estadoRaw
      : undefined;

  const { usuarios, total } = await listarUsuariosPaginado({
    busqueda: url.searchParams.get("q") ?? undefined,
    plan,
    estadoBilling,
    offset,
    limite,
  });

  return NextResponse.json({
    usuarios,
    total,
    pagina,
    limite,
    paginas: Math.max(1, Math.ceil(total / limite)),
  });
}
