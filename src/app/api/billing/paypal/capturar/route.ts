import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, requerirSesion } from "@/lib/auth/sesion";
import { capturarOrdenPayPal } from "@/lib/paypal/cliente";
import { agregarCreditos } from "@/lib/db/creditos";
import {
  marcarPagoAprobado,
  marcarPagoFallido,
  obtenerPagoPorOrderId,
} from "@/lib/db/pagos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BodyReq {
  order_id: string;
}

/**
 * POST /api/billing/paypal/capturar
 * Body: { order_id }
 *
 * Captura el pago en PayPal y acredita los créditos en la cuenta. Es
 * idempotente: si el pago ya fue marcado aprobado, retorna OK sin
 * volver a sumar.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const body = await parsearJSON<BodyReq>(req);
  if (body instanceof NextResponse) return body;
  if (!body.order_id) {
    return NextResponse.json({ error: "falta_order_id" }, { status: 400 });
  }

  const pago = await obtenerPagoPorOrderId(body.order_id);
  if (!pago) {
    return NextResponse.json({ error: "orden_desconocida" }, { status: 404 });
  }
  if (pago.usuario_id !== auth.id) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 403 });
  }
  if (pago.estado === "aprobado") {
    return NextResponse.json({ ok: true, ya_procesado: true });
  }

  let captura: Awaited<ReturnType<typeof capturarOrdenPayPal>>;
  try {
    captura = await capturarOrdenPayPal(body.order_id);
  } catch (err) {
    await marcarPagoFallido(pago.id, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "captura_fallo" }, { status: 502 });
  }

  if (captura.status !== "COMPLETED") {
    await marcarPagoFallido(pago.id, `status=${captura.status}`);
    return NextResponse.json({ error: "captura_no_completada", status: captura.status }, { status: 409 });
  }

  // Sumar créditos a la cuenta. El DAO ya es atómico vía RPC.
  if (pago.cuenta_id && pago.creditos_otorgados > 0) {
    await agregarCreditos(pago.cuenta_id, pago.creditos_otorgados);
  }

  const captureId = captura.purchase_units[0]?.payments?.captures?.[0]?.id;
  await marcarPagoAprobado(pago.id, {
    paypalCaptureId: captureId,
    metadata: { ...pago.metadata, status_paypal: captura.status },
  });

  return NextResponse.json({
    ok: true,
    creditos_acreditados: pago.creditos_otorgados,
    cuenta_id: pago.cuenta_id,
  });
}
