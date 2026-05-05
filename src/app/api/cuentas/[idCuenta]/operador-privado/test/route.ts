import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { enviarMensajeOperadorBypass } from "@/lib/operadorPrivado";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/operador-privado/test
 *
 * Encola un mensaje de prueba al teléfono del operador privado de la
 * cuenta. NO respeta el toggle `operador_privado_alertas` — es un
 * test bajo pedido directo del usuario.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth, cuenta } = acceso;

  const limite = verificarRateLimit(`${auth.id}:test-operador`, 5, 60);
  if (limite) return limite;

  const r = await enviarMensajeOperadorBypass(
    cuenta,
    "✅ Tu operador privado está conectado correctamente.",
  );

  if (!r.ok) {
    const status = r.motivo === "cuenta_desconectada" ? 409 : 400;
    return NextResponse.json({ ok: false, motivo: r.motivo }, { status });
  }
  return NextResponse.json({ ok: true });
}
