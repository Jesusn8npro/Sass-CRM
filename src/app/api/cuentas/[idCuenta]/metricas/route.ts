import { NextResponse, type NextRequest } from "next/server";
import { obtenerMetricas } from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;
  const rl = verificarRateLimit(`${auth.id}:metricas`, 60, 60);
  if (rl) return rl;
  const metricas = await obtenerMetricas(idCuenta);
  return NextResponse.json(metricas);
}
