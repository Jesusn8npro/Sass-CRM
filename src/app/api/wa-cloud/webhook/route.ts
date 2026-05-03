import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — Verificación inicial del webhook por parte de Meta.
 *
 * Meta hace GET con `?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y`.
 * Si `verify_token` matchea uno de los `wa_verify_token` guardados en la
 * tabla `cuentas`, devolvemos el `challenge` en texto plano.
 *
 * El `verify_token` es compartido por TODAS las cuentas del SaaS — la
 * primera que matchee el query param queda asociada vía DB. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return NextResponse.json(
      { error: "Solicitud inválida" },
      { status: 400 },
    );
  }

  const supabase = crearClienteAdmin();
  const { data } = await supabase
    .from("cuentas")
    .select("id")
    .eq("wa_verify_token", token)
    .limit(1)
    .maybeSingle();

  if (!data) {
    console.warn(
      "[wa-cloud webhook] verify_token no matchea ninguna cuenta:",
      token.slice(0, 8) + "…",
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Respondemos el challenge en texto plano (lo exige Meta)
  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/** POST — Eventos entrantes de Meta (mensajes recibidos, status updates,
 * etc.). El payload viene firmado con `X-Hub-Signature-256`. Para v1
 * SOLO loggeamos — la integración real con el bot (insertar mensaje
 * en DB, disparar respuesta IA) se hace en una próxima fase. */
export async function POST(req: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // TODO (próxima fase): validar firma X-Hub-Signature-256 contra
  // wa_app_secret y procesar eventos:
  //   - messages → insertarMensaje + disparar respuesta IA
  //   - statuses → tracking de delivered/read
  console.log(
    "[wa-cloud webhook] evento recibido:",
    JSON.stringify(cuerpo).slice(0, 500),
  );

  // Meta exige respuesta 200 rápida, sino reintenta y duplica
  return NextResponse.json({ ok: true });
}
