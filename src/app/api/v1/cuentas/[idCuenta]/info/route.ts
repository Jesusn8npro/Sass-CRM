/**
 * GET /api/v1/cuentas/[idCuenta]/info
 *
 * Endpoint público de la API v1. Devuelve datos básicos de la cuenta
 * + métricas resumen (no sensibles).
 *
 * Auth: header `Authorization: Bearer sk_live_...` scopeada a `idCuenta`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { obtenerMetricas } from "@/lib/db/metricas";
import { verificarApiKey } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const auth = await verificarApiKey(req);
  if (auth instanceof NextResponse) return auth;

  if (auth.cuenta.id !== idCuenta) {
    return NextResponse.json(
      { error: "Esta API key no tiene acceso a esa cuenta" },
      { status: 403 },
    );
  }

  if (!auth.apiKey.permisos.includes("read")) {
    return NextResponse.json(
      { error: "Esta API key no tiene permiso de lectura" },
      { status: 403 },
    );
  }

  const cuenta = auth.cuenta;
  let metricas: Awaited<ReturnType<typeof obtenerMetricas>> | null = null;
  try {
    metricas = await obtenerMetricas(idCuenta);
  } catch {
    // Si fallan las métricas, devolvemos los básicos igual.
  }

  return NextResponse.json({
    cuenta: {
      id: cuenta.id,
      etiqueta: cuenta.etiqueta,
      telefono: cuenta.telefono,
      estado: cuenta.estado,
      esta_activa: cuenta.esta_activa,
    },
    metricas: metricas
      ? {
          conversaciones_total: metricas.conversaciones_total,
          mensajes_total: metricas.mensajes_total,
          mensajes_hoy: metricas.mensajes_hoy,
          mensajes_ultimos_7d: metricas.mensajes_ultimos_7d,
          conversaciones_necesitan_humano:
            metricas.conversaciones_necesitan_humano,
          citas_proximas_7d: metricas.citas_proximas_7d,
          lead_score_promedio: metricas.lead_score_promedio,
        }
      : null,
  });
}
