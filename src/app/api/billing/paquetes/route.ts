import { NextResponse } from "next/server";
import { listarPaquetesActivos } from "@/lib/db/pagos";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/paquetes
 * Devuelve el catálogo público de paquetes de créditos. Requiere sesión
 * (lo aplica el middleware deny-by-default).
 */
export async function GET() {
  const paquetes = await listarPaquetesActivos();
  return NextResponse.json({ paquetes });
}
