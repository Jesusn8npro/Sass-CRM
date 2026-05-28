import { NextResponse } from "next/server";
import { listarTodasLasCuentasAdmin } from "@/lib/db/cuentas";
import { requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/impersonar — listado completo de cuentas con owner email,
 * usado por la UI cliente de /app/admin/impersonar (que ahora soporta
 * selección por lotes y eliminación).
 */
export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const cuentas = await listarTodasLasCuentasAdmin();
  return NextResponse.json({ cuentas });
}
