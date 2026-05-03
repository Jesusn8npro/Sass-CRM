import { NextResponse, type NextRequest } from "next/server";
import { listarRunsApify, obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * GET /api/cuentas/[idCuenta]/apify/runs
 * Lista los últimos 30 runs de Apify de la cuenta. El cliente hace
 * polling cada 4-5s mientras hay runs en estado "corriendo".
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  const runs = await listarRunsApify(idCuenta, 30);
  return NextResponse.json({ runs });
}
