import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { resolverCredencialesVapi } from "@/lib/vapi-credenciales";
import { sincronizarAnalysisPlanAssistant } from "@/lib/vapi";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ idCuenta: string }> }

/**
 * POST — Parcha el analysisPlan directamente en el assistant de Vapi.
 * Garantiza que TODAS las llamadas (dashboard, outreach, WhatsApp)
 * extraigan datos estructurados sin depender de overrides por llamada.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const { cuenta } = acceso;
  const cred = resolverCredencialesVapi(cuenta);

  if (!cred.apiKey) {
    return NextResponse.json({ error: "Falta la API key de Vapi en la configuración" }, { status: 400 });
  }

  const assistantId = cuenta.vapi_assistant_id?.trim() || null;
  if (!assistantId) {
    return NextResponse.json({ error: "No hay assistant Vapi configurado en esta cuenta" }, { status: 400 });
  }

  try {
    await sincronizarAnalysisPlanAssistant(cred.apiKey, assistantId);
    return NextResponse.json({ ok: true, assistantId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
