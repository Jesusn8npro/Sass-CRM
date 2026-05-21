import { NextResponse, type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
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
  // obtenerMetricas son ~16 queries en paralelo (incl. scan completo de
  // conversaciones). Cacheamos 60s por cuenta: el dashboard tolera KPIs
  // hasta 1 min desactualizados y se evita recomputar en cada poll.
  // El auth/ownership corre ANTES y no se cachea.
  const metricas = await unstable_cache(
    () => obtenerMetricas(idCuenta),
    ["metricas", idCuenta],
    { revalidate: 300, tags: [`metricas:${idCuenta}`] },
  )();
  return NextResponse.json(metricas);
}
