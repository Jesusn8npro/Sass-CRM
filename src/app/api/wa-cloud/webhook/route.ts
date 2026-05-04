import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — Verificación inicial del webhook por parte de Meta.
 *
 * URL esperada: /api/wa-cloud/webhook?cuenta=<id>&hub.mode=subscribe&...
 * Si la URL no incluye `?cuenta=<id>`, caemos al matcheo legacy por
 * verify_token (compatibilidad con cuentas ya configuradas).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const idCuenta = url.searchParams.get("cuenta");

  if (mode !== "subscribe" || !token || !challenge) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const supabase = crearClienteAdmin();
  let q = supabase.from("cuentas").select("id, wa_verify_token").limit(1);
  if (idCuenta) q = q.eq("id", idCuenta);
  else q = q.eq("wa_verify_token", token);
  const { data } = await q.maybeSingle();

  if (!data || !data.wa_verify_token) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!timingSafeEqualStr(data.wa_verify_token, token)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/** POST — Eventos entrantes de Meta. Validamos firma `X-Hub-Signature-256`
 * contra `wa_app_secret` de la cuenta (resuelta por `?cuenta=<id>` o por
 * el primer phone_number_id que aparezca en el payload). */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const firma = req.headers.get("x-hub-signature-256") ?? "";

  const url = new URL(req.url);
  const idCuenta = url.searchParams.get("cuenta");

  let payload: WaPayload;
  try {
    payload = JSON.parse(rawBody) as WaPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const phoneNumberId = extraerPhoneNumberId(payload);
  const supabase = crearClienteAdmin();

  let cuenta: { id: string; wa_app_secret: string | null } | null = null;
  if (idCuenta) {
    const { data } = await supabase
      .from("cuentas")
      .select("id, wa_app_secret")
      .eq("id", idCuenta)
      .maybeSingle();
    cuenta = data ?? null;
  } else if (phoneNumberId) {
    const { data } = await supabase
      .from("cuentas")
      .select("id, wa_app_secret")
      .eq("wa_phone_number_id", phoneNumberId)
      .maybeSingle();
    cuenta = data ?? null;
  }

  if (!cuenta || !cuenta.wa_app_secret) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  if (!verificarFirmaMeta(rawBody, firma, cuenta.wa_app_secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // Procesamiento real del evento se hace en otra fase. Meta exige 200
  // rápido para no reintentar.
  return NextResponse.json({ ok: true });
}

interface WaPayload {
  entry?: Array<{
    changes?: Array<{
      value?: { metadata?: { phone_number_id?: string } };
    }>;
  }>;
}

function extraerPhoneNumberId(p: WaPayload): string | null {
  return p.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
}

function verificarFirmaMeta(
  rawBody: string,
  firmaHeader: string,
  appSecret: string,
): boolean {
  if (!firmaHeader.startsWith("sha256=")) return false;
  const hex = firmaHeader.slice(7);
  const esperado = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  if (hex.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hex), Buffer.from(esperado));
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
