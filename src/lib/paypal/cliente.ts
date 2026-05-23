/**
 * Cliente REST mínimo de PayPal — auth + helpers para órdenes y
 * suscripciones. No usamos el SDK de PayPal porque pesa y solo
 * necesitamos endpoints específicos.
 *
 * Modos: sandbox (PAYPAL_ENV=sandbox) o producción.
 */

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

export function basePayPal(): string {
  return process.env.PAYPAL_ENV === "live" ? LIVE_BASE : SANDBOX_BASE;
}

interface CacheToken {
  access_token: string;
  expira_en: number;
}
let _cacheToken: CacheToken | null = null;

/**
 * Token OAuth2 con cache. PayPal devuelve `expires_in` en segundos
 * (típicamente 9h). Renovamos 5 min antes para no fallar en bordes.
 */
async function obtenerAccessToken(): Promise<string> {
  const ahora = Date.now();
  if (_cacheToken && _cacheToken.expira_en > ahora + 60_000) {
    return _cacheToken.access_token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) {
    throw new Error("PAYPAL_CLIENT_ID y PAYPAL_SECRET deben estar definidos");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${basePayPal()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PayPal auth falló: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _cacheToken = {
    access_token: json.access_token,
    expira_en: ahora + (json.expires_in - 300) * 1000,
  };
  return json.access_token;
}

/** Helper genérico de fetch autenticado a la API de PayPal. */
export async function paypalFetch<T = unknown>(
  path: string,
  opciones: { method?: "GET" | "POST" | "PATCH"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await obtenerAccessToken();
  const res = await fetch(`${basePayPal()}${path}`, {
    method: opciones.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opciones.headers,
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const msg = (data as { message?: string })?.message ?? text.slice(0, 200);
    throw new Error(`PayPal ${path}: ${res.status} ${msg}`);
  }
  return data as T;
}

// ============================================================
// Órdenes (recargas one-time)
// ============================================================

interface OrdenCreada {
  id: string;
  status: string;
}

export async function crearOrdenPayPal(p: {
  montoUsd: number;
  descripcion: string;
  customId?: string;
}): Promise<OrdenCreada> {
  return paypalFetch<OrdenCreada>("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: p.montoUsd.toFixed(2),
          },
          description: p.descripcion,
          custom_id: p.customId,
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        brand_name: "INYECTAIA",
      },
    },
  });
}

interface OrdenCapturada {
  id: string;
  status: string;
  purchase_units: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string; amount: { value: string } }>;
    };
  }>;
}

export async function capturarOrdenPayPal(orderId: string): Promise<OrdenCapturada> {
  return paypalFetch<OrdenCapturada>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    body: {},
  });
}

// ============================================================
// Suscripciones recurrentes
// ============================================================

interface SuscripcionPayPal {
  id: string;
  status: string;
  subscriber?: { email_address?: string };
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string; amount?: { value: string } } };
  start_time?: string;
}

export async function obtenerSuscripcion(subId: string): Promise<SuscripcionPayPal> {
  return paypalFetch<SuscripcionPayPal>(`/v1/billing/subscriptions/${subId}`);
}

export async function cancelarSuscripcionPayPal(
  subId: string,
  motivo: string,
): Promise<void> {
  await paypalFetch(`/v1/billing/subscriptions/${subId}/cancel`, {
    method: "POST",
    body: { reason: motivo.slice(0, 128) },
  });
}

/**
 * Verifica firma de webhook. PayPal expone /v1/notifications/verify-webhook-signature
 * que recibe los headers + body crudo + webhookId y devuelve VERIFICATION
 * status. Sólo usamos esto, no implementamos crypto local porque PayPal
 * rota su clave.
 */
export async function verificarWebhookPayPal(p: {
  headers: Record<string, string | null>;
  rawBody: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // Sin webhook ID configurado = webhook no autorizado.
    return false;
  }
  try {
    const r = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          auth_algo: p.headers["paypal-auth-algo"] ?? p.headers["PAYPAL-AUTH-ALGO"],
          cert_url: p.headers["paypal-cert-url"] ?? p.headers["PAYPAL-CERT-URL"],
          transmission_id: p.headers["paypal-transmission-id"] ?? p.headers["PAYPAL-TRANSMISSION-ID"],
          transmission_sig: p.headers["paypal-transmission-sig"] ?? p.headers["PAYPAL-TRANSMISSION-SIG"],
          transmission_time: p.headers["paypal-transmission-time"] ?? p.headers["PAYPAL-TRANSMISSION-TIME"],
          webhook_id: webhookId,
          webhook_event: JSON.parse(p.rawBody),
        },
      },
    );
    return r.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[paypal] verificación webhook falló:", err);
    return false;
  }
}
