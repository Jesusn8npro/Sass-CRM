import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, requerirSesion } from "@/lib/auth/sesion";
import { obtenerSuscripcion } from "@/lib/paypal/cliente";
import { planIdPayPal } from "@/lib/paypal/planes";
import {
  marcarPagoAprobado,
  obtenerPagoPorSubscriptionId,
} from "@/lib/db/pagos";
import { activarPlanUsuario } from "@/lib/db/usuarios";
import { enviarPagoAprobado } from "@/lib/emails/disparadores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BodyReq {
  subscription_id: string;
}

/**
 * POST /api/billing/paypal/activar
 * Body: { subscription_id }
 *
 * Verifica con PayPal que la suscripción está ACTIVE y activa el plan
 * en nuestra DB. Idempotente: se puede llamar múltiples veces sin
 * causar daño (la última gana).
 */
export async function POST(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const body = await parsearJSON<BodyReq>(req);
  if (body instanceof NextResponse) return body;
  if (!body.subscription_id || typeof body.subscription_id !== "string") {
    return NextResponse.json({ error: "falta_subscription_id" }, { status: 400 });
  }

  const sub = await obtenerSuscripcion(body.subscription_id);
  if (sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
    return NextResponse.json(
      { error: "suscripcion_no_activa", status: sub.status },
      { status: 409 },
    );
  }

  // Verificá que la sub corresponde a este usuario via la tabla pagos
  const pago = await obtenerPagoPorSubscriptionId(body.subscription_id);
  if (!pago || pago.usuario_id !== auth.id) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 403 });
  }

  // Determinar qué plan corresponde por el plan_id de PayPal
  const planIdPro = planIdPayPal("pro");
  const planIdBusiness = planIdPayPal("business");
  const planMetadata = (pago.metadata?.plan ?? null) as "pro" | "business" | null;
  const planResuelto: "pro" | "business" =
    planMetadata ??
    (planIdPro && pago.metadata?.plan_id_paypal === planIdPro ? "pro" : "business");

  // Calcular vence_en según next_billing_time o +30d default
  const venceEn =
    sub.billing_info?.next_billing_time ??
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  await activarPlanUsuario({
    usuarioId: auth.id,
    plan: planResuelto,
    paypalSubscriptionId: body.subscription_id,
    paypalPlanId:
      planResuelto === "pro" ? planIdPro : planIdBusiness,
    venceEn,
  });

  await marcarPagoAprobado(pago.id, {
    metadata: { ...pago.metadata, status_paypal: sub.status, vence_en: venceEn },
  });

  // Email transaccional fire-and-forget — no bloquea la respuesta.
  void enviarPagoAprobado(auth.id, pago.id);

  return NextResponse.json({ ok: true, plan: planResuelto, vence_en: venceEn });
}
