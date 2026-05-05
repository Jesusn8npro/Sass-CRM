import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, requerirSesion } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { paypalFetch } from "@/lib/paypal/cliente";
import { planIdPayPal } from "@/lib/paypal/planes";
import { crearPagoPendiente } from "@/lib/db/pagos";
import { PLANES } from "@/lib/paypal/planes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BodyReq {
  plan: "pro" | "business";
}

/**
 * POST /api/billing/paypal/crear-suscripcion
 * Body: { plan: "pro" | "business" }
 *
 * Crea una Suscripción en estado APPROVAL_PENDING. El frontend recibe
 * el ID y se lo pasa al SDK Smart Buttons; PayPal lleva al usuario al
 * popup, donde aprueba. Después /activar lee el estado final.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const limite = verificarRateLimit(`${auth.id}:billing-suscripcion`, 10, 60);
  if (limite) return limite;

  const body = await parsearJSON<BodyReq>(req);
  if (body instanceof NextResponse) return body;
  if (body.plan !== "pro" && body.plan !== "business") {
    return NextResponse.json({ error: "plan_invalido" }, { status: 400 });
  }

  const planId = planIdPayPal(body.plan);
  if (!planId) {
    return NextResponse.json(
      {
        error: "plan_no_configurado",
        mensaje: `Falta correr /api/billing/setup-plan para crear el ${body.plan} en PayPal.`,
      },
      { status: 503 },
    );
  }

  const def = PLANES[body.plan];

  const sub = await paypalFetch<{ id: string; status: string }>(
    "/v1/billing/subscriptions",
    {
      method: "POST",
      body: {
        plan_id: planId,
        custom_id: auth.id,
        subscriber: { email_address: auth.email },
        application_context: {
          brand_name: "Sass-CRM",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
        },
      },
    },
  );

  // Registramos el intento como pago pendiente para audit y para wire
  // el webhook después.
  await crearPagoPendiente({
    usuarioId: auth.id,
    tipo: "suscripcion",
    montoUsd: def.precioMensualUsd,
    paypalSubscriptionId: sub.id,
    metadata: { plan: body.plan, plan_id_paypal: planId },
  });

  return NextResponse.json({ ok: true, subscription_id: sub.id, status: sub.status });
}
