import { NextResponse } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { contarLeadsPorEstadoProspeccion } from "@/lib/db/leadsExtraidos";
import { contarLlamadasProspeccionUltimaHora } from "@/lib/db/outreachLogs";

export const dynamic = "force-dynamic";

/**
 * GET /api/cuentas/[idCuenta]/prospeccion/stats
 * Contadores del pipeline para el dashboard de prospección.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const [conteos, llamadasUltimaHora] = await Promise.all([
    contarLeadsPorEstadoProspeccion(idCuenta),
    contarLlamadasProspeccionUltimaHora(idCuenta),
  ]);

  const total = Object.values(conteos).reduce((s, v) => s + v, 0);
  const contactados =
    (conteos.llamado ?? 0) +
    (conteos.emaileado ?? 0) +
    (conteos.completado ?? 0);

  return NextResponse.json({
    conteos,
    total,
    contactados,
    llamadas_ultima_hora: llamadasUltimaHora,
    limite_hora: parseInt(process.env.OUTREACH_MAX_LLAMADAS_POR_HORA ?? "10", 10),
    modo_prueba: process.env.OUTREACH_TEST_MODE === "true",
  });
}
