import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { crearOrdenPayPal } from "@/lib/paypal/cliente";
import { crearPagoPendiente, obtenerPaquete } from "@/lib/db/pagos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BodyReq {
  paquete_id: string;
  cuenta_id: string; // a qué cuenta WhatsApp se acreditan los créditos
}

/**
 * POST /api/billing/paypal/crear-orden
 * Body: { paquete_id, cuenta_id }
 *
 * Crea una orden one-time de PayPal para un paquete de créditos.
 * Devuelve el order_id que el frontend pasa al SDK Smart Buttons.
 */
export async function POST(req: NextRequest) {
  const body = await parsearJSON<BodyReq>(req);
  if (body instanceof NextResponse) return body;
  if (!body.paquete_id || !body.cuenta_id) {
    return NextResponse.json({ error: "faltan_parametros" }, { status: 400 });
  }

  const acceso = await verificarAccesoCuenta(body.cuenta_id);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  const limite = verificarRateLimit(`${auth.id}:billing-recarga`, 10, 60);
  if (limite) return limite;

  const paquete = await obtenerPaquete(body.paquete_id);
  if (!paquete) {
    return NextResponse.json({ error: "paquete_no_encontrado" }, { status: 404 });
  }

  const orden = await crearOrdenPayPal({
    montoUsd: paquete.precio_usd,
    descripcion: `${paquete.nombre} — ${paquete.creditos} créditos`,
    customId: `${auth.id}|${body.cuenta_id}|${paquete.id}`,
  });

  await crearPagoPendiente({
    usuarioId: auth.id,
    cuentaId: body.cuenta_id,
    tipo: "recarga_creditos",
    montoUsd: paquete.precio_usd,
    creditosOtorgados: paquete.creditos,
    paypalOrderId: orden.id,
    metadata: { paquete_id: paquete.id, paquete_nombre: paquete.nombre },
  });

  return NextResponse.json({ ok: true, order_id: orden.id });
}
