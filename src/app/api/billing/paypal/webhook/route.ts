import { NextResponse, type NextRequest } from "next/server";
import { verificarWebhookPayPal } from "@/lib/paypal/cliente";
import {
  activarPlanUsuario,
  marcarBillingUsuario,
  obtenerUsuarioPorSubscriptionId,
} from "@/lib/db/usuarios";
import { enviarPagoFallido } from "@/lib/emails/disparadores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/billing/paypal/webhook
 *
 * Recibe eventos de PayPal (suscripciones renovadas, fallos, cancelaciones).
 * El middleware permite esta ruta sin sesión; verificamos la firma con
 * la API de PayPal antes de procesar cualquier mutación.
 *
 * Eventos manejados:
 *  - BILLING.SUBSCRIPTION.ACTIVATED → marca activo + extiende vence_en
 *  - BILLING.SUBSCRIPTION.CANCELLED → vuelve a free
 *  - BILLING.SUBSCRIPTION.SUSPENDED / .EXPIRED → estado_billing=suspendido
 *  - BILLING.SUBSCRIPTION.PAYMENT.FAILED / PAYMENT.SALE.DENIED → impago
 *  - PAYMENT.SALE.COMPLETED en una suscripción → renueva vence_en +30d
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const headers: Record<string, string | null> = {};
  for (const [k, v] of req.headers) headers[k.toLowerCase()] = v;

  const ok = await verificarWebhookPayPal({ headers, rawBody });
  if (!ok) {
    return NextResponse.json({ error: "firma_invalida" }, { status: 401 });
  }

  let evento: { event_type?: string; resource?: Record<string, unknown> };
  try {
    evento = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = evento.event_type ?? "";
  const recurso = evento.resource ?? {};

  // Las suscripciones traen el ID en resource.id; los pagos en resource.billing_agreement_id
  const subId =
    (recurso.id as string | undefined) ??
    (recurso.billing_agreement_id as string | undefined);

  if (!subId) {
    return NextResponse.json({ ok: true, ignorado: "sin_subscription_id" });
  }

  const usuario = await obtenerUsuarioPorSubscriptionId(subId);
  if (!usuario) {
    // Webhook llegó antes de que /activar termine, o sub de otro tenant.
    return NextResponse.json({ ok: true, ignorado: "usuario_no_encontrado" });
  }

  if (tipo === "BILLING.SUBSCRIPTION.ACTIVATED") {
    const venceEn = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await activarPlanUsuario({
      usuarioId: usuario.id,
      plan: (usuario.plan === "business" ? "business" : "pro") as "pro" | "business",
      venceEn,
    });
    return NextResponse.json({ ok: true });
  }

  if (tipo === "PAYMENT.SALE.COMPLETED") {
    // Renovación mensual exitosa — extiende vence_en +30d
    const venceEn = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    await activarPlanUsuario({
      usuarioId: usuario.id,
      plan: (usuario.plan === "business" ? "business" : "pro") as "pro" | "business",
      venceEn,
    });
    return NextResponse.json({ ok: true });
  }

  if (tipo === "BILLING.SUBSCRIPTION.CANCELLED" || tipo === "BILLING.SUBSCRIPTION.EXPIRED") {
    await activarPlanUsuario({
      usuarioId: usuario.id,
      plan: "free",
      paypalSubscriptionId: null,
      paypalPlanId: null,
      venceEn: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  }

  if (tipo === "BILLING.SUBSCRIPTION.SUSPENDED") {
    await marcarBillingUsuario(usuario.id, "suspendido");
    return NextResponse.json({ ok: true });
  }

  if (tipo === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" || tipo === "PAYMENT.SALE.DENIED") {
    await marcarBillingUsuario(usuario.id, "impago");
    // Email transaccional fire-and-forget — no bloquea la respuesta a PayPal.
    const motivoTexto =
      tipo === "PAYMENT.SALE.DENIED"
        ? "El pago fue denegado por la pasarela."
        : "El cobro automático de la suscripción no pudo procesarse.";
    void enviarPagoFallido(usuario.id, motivoTexto);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignorado: tipo });
}
