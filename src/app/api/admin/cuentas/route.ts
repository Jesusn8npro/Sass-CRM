import { NextResponse } from "next/server";
import { listarCuentas } from "@/lib/db/cuentas";
import { requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/cuentas — listado mínimo (id + etiqueta) de todas las
 * cuentas del SaaS, para alimentar dropdowns en el panel admin
 * (filtros de logs, etc).
 */
export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  const cuentas = await listarCuentas();
  return NextResponse.json({
    cuentas: cuentas.map((c) => ({
      id: c.id,
      etiqueta: c.etiqueta,
    })),
  });
}
