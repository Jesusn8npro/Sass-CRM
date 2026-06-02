import { NextResponse, type NextRequest } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import { listarSolicitudesAcademia } from "@/lib/db/solicitudesAcademia";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/solicitudes-academia?estado=pendiente — lista para el panel admin. */
export async function GET(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const estado = new URL(req.url).searchParams.get("estado") || undefined;
  const solicitudes = await listarSolicitudesAcademia(estado || undefined);
  return NextResponse.json({ solicitudes });
}
