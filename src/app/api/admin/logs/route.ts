import { NextResponse, type NextRequest } from "next/server";
import { listarEventosLog, type NivelEvento } from "@/lib/db/eventosLog";
import { requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

const NIVELES_VALIDOS: NivelEvento[] = ["info", "warn", "error", "critical"];

/**
 * GET /api/admin/logs — listado de eventos del sistema.
 *
 * Query params:
 *   nivel      — info | warn | error | critical
 *   cuenta_id  — UUID
 *   desde      — ISO timestamp
 *   limite     — default 100, max 500
 */
export async function GET(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const nivelRaw = url.searchParams.get("nivel");
  const cuentaIdRaw = url.searchParams.get("cuenta_id");
  const desdeRaw = url.searchParams.get("desde");
  const limiteRaw = parseInt(url.searchParams.get("limite") ?? "100", 10);

  const nivel =
    nivelRaw && NIVELES_VALIDOS.includes(nivelRaw as NivelEvento)
      ? (nivelRaw as NivelEvento)
      : undefined;

  const limite = Math.min(
    Math.max(Number.isFinite(limiteRaw) ? limiteRaw : 100, 1),
    500,
  );

  const { eventos, total } = await listarEventosLog({
    nivel,
    cuentaId: cuentaIdRaw ?? undefined,
    desde: desdeRaw ?? undefined,
    limite,
  });

  return NextResponse.json({ eventos, total });
}
