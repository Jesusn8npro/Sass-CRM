import { NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Endpoint público de health check. Devuelve 200 si la app responde y
 * Postgres está accesible. Útil para Railway/EasyPanel/uptime monitors.
 */
export async function GET() {
  const inicio = Date.now();
  let dbOk = false;
  try {
    const supabase = crearClienteAdmin();
    const { error } = await supabase.from("cuentas").select("id").limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }
  const status = dbOk ? 200 : 503;
  return NextResponse.json(
    {
      ok: dbOk,
      db: dbOk ? "ok" : "fail",
      latencia_ms: Date.now() - inicio,
      ts: new Date().toISOString(),
    },
    { status },
  );
}
