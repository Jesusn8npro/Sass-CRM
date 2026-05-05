import { NextResponse } from "next/server";
import {
  contarCuentasActivasGlobal,
  contarUsuariosPorPlan,
  listarUsoMesGlobal,
  sumaCostoIaGlobal,
  sumarPagosAprobados,
} from "@/lib/baseDatos";
import { requerirAdmin } from "@/lib/auth/sesion";
import { PLANES } from "@/lib/paypal/planes";

export const dynamic = "force-dynamic";

const SIETE_DIAS_SEG = 7 * 24 * 60 * 60;

/**
 * GET /api/admin/kpis — resumen global del SaaS.
 *  - usuarios por plan
 *  - MRR estimado (precio_plan × usuarios pagos)
 *  - cobranzas último mes (suma pagos aprobados)
 *  - costo IA último mes
 *  - cuentas activas (heartbeat <= 7 días)
 */
export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const ahora = new Date();
  const desdeUltMes = new Date(
    ahora.getFullYear(),
    ahora.getMonth() - 1,
    ahora.getDate(),
  ).toISOString();

  const [usuariosPorPlan, cobranzasMes, costoIaMes, costoPorProveedor, cuentasActivas] =
    await Promise.all([
      contarUsuariosPorPlan(),
      sumarPagosAprobados(desdeUltMes),
      sumaCostoIaGlobal(desdeUltMes),
      listarUsoMesGlobal(desdeUltMes),
      contarCuentasActivasGlobal(SIETE_DIAS_SEG),
    ]);

  const mrrEstimado =
    usuariosPorPlan.pro * PLANES.pro.precioMensualUsd +
    usuariosPorPlan.business * PLANES.business.precioMensualUsd;

  const totalUsuarios =
    usuariosPorPlan.free + usuariosPorPlan.pro + usuariosPorPlan.business;

  return NextResponse.json({
    usuarios: {
      total: totalUsuarios,
      ...usuariosPorPlan,
    },
    mrr_estimado_usd: mrrEstimado,
    cobranzas_ultimo_mes_usd: cobranzasMes,
    costo_ia_ultimo_mes_usd: costoIaMes,
    costo_por_proveedor: costoPorProveedor,
    cuentas_activas_7d: cuentasActivas,
  });
}
