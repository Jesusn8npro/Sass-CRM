import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, requerirSesion } from "@/lib/auth/sesion";
import { paypalFetch } from "@/lib/paypal/cliente";
import { PLANES, planIdPayPal } from "@/lib/paypal/planes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/billing/setup-plan
 * Body: { plan: "pro" | "business" }
 *
 * Crea Producto + Plan en PayPal y devuelve el Plan ID. Lo corrés UNA
 * SOLA VEZ y guardás el ID en .env como PAYPAL_PLAN_PRO_ID o
 * PAYPAL_PLAN_BUSINESS_ID. Si ya está seteado, devuelve el existente.
 *
 * Restricción: sólo lo puede correr un usuario logueado. En producción
 * conviene restringir a un email admin con un guard adicional.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  // Lock down: sólo el operador (vos) puede setupear planes en producción.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (process.env.PAYPAL_ENV === "live" && adminEmail && auth.email !== adminEmail) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 403 });
  }

  const body = await parsearJSON<{ plan?: "pro" | "business" }>(req);
  if (body instanceof NextResponse) return body;
  if (body.plan !== "pro" && body.plan !== "business") {
    return NextResponse.json({ error: "plan_invalido" }, { status: 400 });
  }

  const existente = planIdPayPal(body.plan);
  if (existente) {
    return NextResponse.json({
      ok: true,
      plan_id: existente,
      ya_existia: true,
    });
  }

  const def = PLANES[body.plan];

  // 1. Crear producto
  const producto = await paypalFetch<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: {
      name: `Sass-CRM ${def.nombre}`,
      description: `Suscripción mensual al plan ${def.nombre}`,
      type: "SERVICE",
      category: "SOFTWARE",
    },
  });

  // 2. Crear plan recurrente sobre el producto
  const plan = await paypalFetch<{ id: string }>("/v1/billing/plans", {
    method: "POST",
    body: {
      product_id: producto.id,
      name: `Sass-CRM ${def.nombre} Mensual`,
      description: `Plan ${def.nombre} — facturación mensual`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // 0 = infinito
          pricing_scheme: {
            fixed_price: {
              value: def.precioMensualUsd.toFixed(2),
              currency_code: "USD",
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    plan_id: plan.id,
    producto_id: producto.id,
    instrucciones: `Agregá esta línea a tu .env.local:\n${def.envEnvVarPlanId}=${plan.id}`,
  });
}
