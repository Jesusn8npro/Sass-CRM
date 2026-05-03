import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/** POST — Suscribe la app de Meta al webhook de la WhatsApp Business
 * Account, para empezar a recibir mensajes entrantes.
 *
 * Llama a:  POST https://graph.facebook.com/v20.0/{wa_business_account_id}/subscribed_apps
 *           Authorization: Bearer {access_token}
 *
 * Meta NO acepta el callback URL en este endpoint — el callback se
 * configura del lado del Meta App Dashboard. Esta llamada solo le
 * dice "esta WABA quiere recibir eventos de mi app". */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  if (!cuenta.wa_business_account_id || !cuenta.wa_access_token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Faltan credenciales: necesitás Business Account ID y Access Token.",
      },
      { status: 400 },
    );
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(
      cuenta.wa_business_account_id,
    )}/subscribed_apps`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cuenta.wa_access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          error: data.error?.message ?? `HTTP ${res.status}`,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
