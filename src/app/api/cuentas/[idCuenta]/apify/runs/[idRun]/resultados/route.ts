import { NextResponse, type NextRequest } from "next/server";
import {
  listarLeadsDeRun,
  obtenerCuenta,
  obtenerRunApify,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idRun: string }>;
}

/**
 * GET /api/cuentas/[idCuenta]/apify/runs/[idRun]/resultados
 *
 * Devuelve los leads que persistimos en leads_extraidos para este run.
 * NO consulta Apify on-demand (los items ya estan en nuestra DB).
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idRun } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  const run = await obtenerRunApify(idRun);
  if (!run || run.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "run_no_encontrado" }, { status: 404 });
  }

  const leads = await listarLeadsDeRun(idRun);
  return NextResponse.json({ leads });
}
