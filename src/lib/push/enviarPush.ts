/**
 * Envío de push notifications vía Web Push Protocol (sin web-push).
 * Firma VAPID manualmente con Web Crypto (Node ≥ 20).
 */
import { db } from "@/lib/db/cliente";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "";

function b64url(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(Buffer.from(padded, "base64"));
  return bytes.buffer as ArrayBuffer;
}

async function firmarVapid(audience: string): Promise<string> {
  const enc = (obj: unknown) =>
    b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const header = enc({ typ: "JWT", alg: "ES256" });
  const now = Math.floor(Date.now() / 1000);
  const payload = enc({ aud: audience, exp: now + 43200, sub: VAPID_SUBJECT });
  const data = `${header}.${payload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    b64urlDecode(VAPID_PRIVATE),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return `${data}.${b64url(sig)}`;
}

async function enviarUna(endpoint: string, payload: string): Promise<void> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await firmarVapid(audience);
  await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      "Content-Type": "application/json",
      TTL: "86400",
    },
    body: payload,
  });
}

export async function enviarPushHandoff(
  cuentaId: string,
  conversacionId: string,
  nombre: string,
): Promise<void> {
  if (!VAPID_PRIVATE || !VAPID_PUBLIC) return;
  const { data: subs } = await db()
    .from("push_subscriptions")
    .select("endpoint")
    .eq("cuenta_id", cuentaId);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    titulo: "⚠ Atención requerida",
    cuerpo: `${nombre} necesita un humano`,
    url: `/app/cuentas/${cuentaId}/conversaciones?conv=${conversacionId}`,
    tag: `handoff-${conversacionId}`,
  });

  await Promise.allSettled(
    subs.map((s) => enviarUna(s.endpoint as string, payload)),
  );
}
