import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, requerirSesion } from "@/lib/auth/sesion";
import { cancelarSuscripcionPayPal } from "@/lib/paypal/cliente";
import { obtenerUsuarioApp, marcarBillingUsuario } from "@/lib/db/usuarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BodyReq {
  motivo?: string;
}

/**
 * POST /api/billing/paypal/cancelar
 * Cancela la suscripción ACTIVA del usuario actual. La suscripción
 * sigue funcionando hasta el final del período pagado — no es prorrata.
 * El plan vuelve a `free` cuando llega el webhook BILLING.SUBSCRIPTION.CANCELLED.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const usuario = await obtenerUsuarioApp(auth.id);
  if (!usuario?.paypal_subscription_id) {
    return NextResponse.json(
      { error: "sin_suscripcion_activa" },
      { status: 404 },
    );
  }

  const body = await parsearJSON<BodyReq>(req);
  if (body instanceof NextResponse) return body;
  const motivo = body.motivo?.trim() || "Cancelado por el usuario";

  try {
    await cancelarSuscripcionPayPal(usuario.paypal_subscription_id, motivo);
  } catch (err) {
    console.error("[paypal:cancelar]", err);
    return NextResponse.json({ error: "error_cancelando" }, { status: 502 });
  }

  // Marcamos prueba en DB; el plan se baja a free cuando llegue webhook
  await marcarBillingUsuario(auth.id, "prueba");

  return NextResponse.json({ ok: true, mensaje: "Suscripción cancelada. Seguís con acceso hasta el final del período pagado." });
}
