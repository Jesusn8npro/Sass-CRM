import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/cliente";
import { enviarReporteSemanal } from "@/lib/emails/disparadores";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Permitimos que el handler corra varios segundos si hay muchas cuentas.
export const maxDuration = 300;

/**
 * Cron público protegido por header `x-cron-secret`. Itera sobre todas
 * las cuentas no archivadas que alguna vez se conectaron (tienen
 * `ultimo_heartbeat` no nulo) y dispara el email de reporte semanal.
 *
 * Idempotencia: el disparador usa una clave por cuenta+semana ISO en
 * el header X-Entity-Ref-ID de Resend, así que si el cron corre dos
 * veces el segundo envío queda deduplicado.
 *
 * Si hay >500 cuentas, paginamos para no traer todo a memoria.
 */
export async function POST(request: NextRequest) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) {
    log.warn("[cron] CRON_SECRET no configurada — endpoint inutilizable");
    return NextResponse.json(
      { error: "CRON_SECRET no configurada en el servidor" },
      { status: 500 },
    );
  }
  const recibido = request.headers.get("x-cron-secret");
  if (recibido !== esperado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  let enviados = 0;
  let omitidos = 0;
  let errores = 0;

  const tamanoPagina = 200;
  let offset = 0;
  let total = 0;

  // Loop de paginación. Cortamos cuando una página vuelve vacía.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db()
      .from("cuentas")
      .select("id")
      .eq("esta_archivada", false)
      .not("ultimo_heartbeat", "is", null)
      .order("creada_en", { ascending: true })
      .range(offset, offset + tamanoPagina - 1);

    if (error) {
      log.error({ err: error.message }, "[cron] error listando cuentas");
      return NextResponse.json(
        { error: "Error consultando cuentas", detalle: error.message },
        { status: 500 },
      );
    }

    const filas = (data ?? []) as { id: string }[];
    if (filas.length === 0) break;

    for (const c of filas) {
      total += 1;
      const r = await enviarReporteSemanal(c.id);
      if (r === "enviado") enviados += 1;
      else if (r === "omitido") omitidos += 1;
      else errores += 1;
      // Throttle 100ms entre envíos para no saturar Resend (10 rps).
      await new Promise((res) => setTimeout(res, 100));
    }

    if (filas.length < tamanoPagina) break;
    offset += tamanoPagina;
  }

  const ms = Date.now() - inicio;
  log.info(
    { total, enviados, omitidos, errores, ms },
    "[cron] reporte semanal completado",
  );
  return NextResponse.json({
    ok: true,
    total,
    enviados,
    omitidos,
    errores,
    ms,
  });
}
