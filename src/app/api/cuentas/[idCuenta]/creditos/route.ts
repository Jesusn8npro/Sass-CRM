import { NextResponse, type NextRequest } from "next/server";
import {
  listarUsoCreditos,
  obtenerCuenta,
  obtenerSaldo,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * GET /api/cuentas/[idCuenta]/creditos
 * Devuelve saldo + últimos 50 movimientos de uso.
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

  const [saldo, uso] = await Promise.all([
    obtenerSaldo(idCuenta),
    listarUsoCreditos(idCuenta, 50),
  ]);

  return NextResponse.json({
    saldo: saldo ?? {
      cuenta_id: idCuenta,
      saldo_actual: 0,
      saldo_mensual: 0,
      proximo_reset: null,
      actualizado_en: null,
    },
    uso,
  });
}
