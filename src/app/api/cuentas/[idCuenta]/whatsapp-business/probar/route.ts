import { NextResponse, type NextRequest } from "next/server";
import { actualizarCuenta, obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/** POST — Pingea Meta Graph API con las credenciales guardadas para
 * verificar que el Phone Number ID + Access Token son válidos.
 *
 * Llama a:  GET https://graph.facebook.com/v20.0/{phone_number_id}
 *           Authorization: Bearer {access_token}
 *
 * Si responde 200 con `display_phone_number` → marca wa_estado='conectado'.
 * Si falla → wa_estado='error' y guarda el mensaje. */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  if (!cuenta.wa_phone_number_id || !cuenta.wa_access_token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Faltan credenciales: cargá Phone Number ID y Access Token primero.",
      },
      { status: 400 },
    );
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(
      cuenta.wa_phone_number_id,
    )}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${cuenta.wa_access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string; type?: string; code?: number };
    };

    if (!res.ok || data.error) {
      const msg =
        data.error?.message ||
        `HTTP ${res.status}: respuesta inesperada de Meta`;
      await actualizarCuenta(idCuenta, {
        wa_estado: "error",
        wa_ultimo_error: msg,
      });
      return NextResponse.json(
        { ok: false, error: msg },
        { status: 200 }, // 200 aunque falle: el cliente lee `ok`
      );
    }

    await actualizarCuenta(idCuenta, {
      wa_estado: "conectado",
      wa_verificada_en: new Date().toISOString(),
      wa_ultimo_error: null,
    });

    return NextResponse.json({
      ok: true,
      display_phone_number: data.display_phone_number,
      verified_name: data.verified_name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await actualizarCuenta(idCuenta, {
      wa_estado: "error",
      wa_ultimo_error: msg,
    });
    return NextResponse.json(
      { ok: false, error: `Error de red: ${msg}` },
      { status: 200 },
    );
  }
}
