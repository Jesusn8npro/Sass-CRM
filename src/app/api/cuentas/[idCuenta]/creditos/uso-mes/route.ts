import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { listarUsoMes } from "@/lib/db/meteringUso";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ idCuenta: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const inicioDeMes = new Date();
  inicioDeMes.setDate(1);
  inicioDeMes.setHours(0, 0, 0, 0);

  const uso = await listarUsoMes(idCuenta, inicioDeMes.toISOString());
  return NextResponse.json({
    uso,
    etiqueta: acceso.cuenta.etiqueta,
    limites_gasto: acceso.cuenta.limites_gasto ?? {},
  });
}
