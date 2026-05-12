/**
 * GET /api/admin/metricas — métricas globales en JSON.
 * Protegido por sesión de super-admin.
 *
 * Sirve para que el frontend del panel /admin las consuma en client
 * components con refresh manual (botón "Actualizar"). Las páginas
 * server-side ya hacen fetch directo a DB sin pasar por acá.
 */
import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import {
  obtenerMetricasGlobales,
  listarCuentasCaidas,
} from "@/lib/admin/reportes";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const [metricas, caidas] = await Promise.all([
      obtenerMetricasGlobales(),
      listarCuentasCaidas(),
    ]);
    return NextResponse.json({
      metricas,
      cuentas_caidas: caidas,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: detalle },
      { status: 500 },
    );
  }
}
