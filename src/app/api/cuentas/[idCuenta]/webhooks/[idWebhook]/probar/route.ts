import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idWebhook: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/webhooks/[idWebhook]/probar
 *
 * Dispara un POST de prueba a la URL del webhook con un payload
 * dummy. Útil para que el usuario verifique en su n8n / Make que
 * el endpoint recibe correctamente.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idWebhook } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const supabase = crearClienteAdmin();
  const { data: webhook } = await supabase
    .from("webhooks_salientes")
    .select("*")
    .eq("id", idWebhook)
    .eq("cuenta_id", idCuenta)
    .maybeSingle();
  if (!webhook) {
    return NextResponse.json({ error: "Webhook no encontrado" }, { status: 404 });
  }

  const w = webhook as {
    url: string;
    secret: string | null;
    nombre: string;
  };

  const payload = {
    evento: "prueba",
    cuenta_id: idCuenta,
    cuenta_etiqueta: cuenta.etiqueta,
    timestamp: new Date().toISOString(),
    mensaje: "Este es un webhook de prueba disparado desde el panel.",
    datos: { ejemplo: true },
  };

  let resultado: string;
  let ok = false;
  let status = 0;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Sass-CRM-Webhook/1.0",
    };
    if (w.secret) headers["x-webhook-secret"] = w.secret;
    const res = await fetch(w.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // Timeout corto para que no cuelgue el endpoint si la URL muere
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    ok = res.ok;
    resultado = ok
      ? `✓ ${status} OK`
      : `✗ HTTP ${status} — el endpoint respondió con error`;
  } catch (err) {
    const det = err instanceof Error ? err.message : String(err);
    resultado = `✗ ${det.slice(0, 200)}`;
  }

  // Actualizar stats
  await supabase
    .from("webhooks_salientes")
    .update({
      ultimo_disparo_en: new Date().toISOString(),
      ultimo_resultado: resultado,
      total_disparos: (webhook as { total_disparos: number }).total_disparos + 1,
      total_fallos:
        (webhook as { total_fallos: number }).total_fallos + (ok ? 0 : 1),
    })
    .eq("id", idWebhook);

  return NextResponse.json({ ok, status, resultado });
}
