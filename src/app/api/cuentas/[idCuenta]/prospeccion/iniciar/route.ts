import { NextRequest, NextResponse } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import { procesarOutreachCuenta, type ModoContacto } from "@/lib/outreach/orquestador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/cuentas/[idCuenta]/prospeccion/iniciar
 *
 * Dispara el orquestador para esta cuenta de forma manual.
 * Acepta filtro por runId y selección de modo de contacto.
 *
 * Body: { runId?: string; modo?: "ambos" | "solo_llamadas" | "solo_email" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const body = await parsearJSON<{ runId?: string; modo?: string }>(req);
  if (body instanceof NextResponse) return body;

  const modos: ModoContacto[] = ["ambos", "solo_llamadas", "solo_email"];
  const modo: ModoContacto = modos.includes(body.modo as ModoContacto)
    ? (body.modo as ModoContacto)
    : "ambos";

  const runId = typeof body.runId === "string" && body.runId.trim()
    ? body.runId.trim()
    : undefined;

  try {
    const resumen = await procesarOutreachCuenta(idCuenta, { runId, modo });
    return NextResponse.json({
      ok: true,
      ...resumen,
      mensaje: resumen.procesados === 0
        ? "No había leads nuevos para procesar."
        : `${resumen.procesados} leads procesados — ${resumen.llamadas} llamadas iniciadas, ${resumen.emails} emails enviados.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
