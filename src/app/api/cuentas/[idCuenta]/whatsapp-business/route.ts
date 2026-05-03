import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/** GET — Devuelve estado + datos de Meta Cloud API.
 *
 * No exponemos al cliente el `wa_access_token` ni el `wa_app_secret`
 * completos: los censuramos a "***últimos 4". El verify_token sí va
 * porque el dueño lo necesita ver para configurarlo en Meta. */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  // Si no tiene verify_token, generamos uno automático (idempotente —
  // solo la primera vez). Es lo que el dueño usa para validar el webhook
  // del lado de Meta.
  let verifyToken = cuenta.wa_verify_token;
  if (!verifyToken) {
    verifyToken = randomBytes(24).toString("hex");
    await actualizarCuenta(idCuenta, { wa_verify_token: verifyToken });
  }

  return NextResponse.json({
    estado: cuenta.wa_estado,
    phone_number_id: cuenta.wa_phone_number_id,
    business_account_id: cuenta.wa_business_account_id,
    access_token_preview: censurar(cuenta.wa_access_token),
    access_token_configurado: !!cuenta.wa_access_token,
    app_secret_configurado: !!cuenta.wa_app_secret,
    verify_token: verifyToken,
    verificada_en: cuenta.wa_verificada_en,
    ultimo_error: cuenta.wa_ultimo_error,
  });
}

/** PATCH — Guarda credenciales (Phone Number ID, Business Account ID,
 * Access Token, App Secret). El verify_token NO se edita acá — se
 * genera automáticamente desde el GET. */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: {
    phone_number_id?: unknown;
    business_account_id?: unknown;
    access_token?: unknown;
    app_secret?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cambios: Parameters<typeof actualizarCuenta>[1] = {};
  if (typeof payload.phone_number_id === "string") {
    cambios.wa_phone_number_id = payload.phone_number_id.trim() || null;
  }
  if (typeof payload.business_account_id === "string") {
    cambios.wa_business_account_id =
      payload.business_account_id.trim() || null;
  }
  if (typeof payload.access_token === "string") {
    cambios.wa_access_token = payload.access_token.trim() || null;
  }
  if (typeof payload.app_secret === "string") {
    cambios.wa_app_secret = payload.app_secret.trim() || null;
  }

  // Si cambió alguna credencial, marcamos como "verificando" hasta que
  // el dueño dispare /probar y confirmemos que funciona.
  if (Object.keys(cambios).length > 0) {
    cambios.wa_estado = "verificando";
    cambios.wa_ultimo_error = null;
  }

  await actualizarCuenta(idCuenta, cambios);
  return NextResponse.json({ ok: true });
}

function censurar(s: string | null): string {
  if (!s || s.length < 8) return "";
  return `${"•".repeat(20)}${s.slice(-4)}`;
}
