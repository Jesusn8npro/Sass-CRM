/**
 * POST /api/cron/generar-articulos
 * Protegido por header `x-cron-secret`. Corre cada 5 min en Vercel.
 * Verifica horario configurado en blog_config antes de generar.
 */
import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/logger";
import { obtenerBlogConfig, debeEjecutarAhora } from "@/lib/db/blogConfig";
import { ejecutarGeneracionBlog } from "@/lib/blog/ejecutarGeneracion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) {
    log.warn("[cron:blog] CRON_SECRET no configurada");
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 500 });
  }
  if (request.headers.get("x-cron-secret") !== esperado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const forzar = new URL(request.url).searchParams.get("forzar") === "1";

  // Verificar horario configurado
  let config;
  try {
    config = await obtenerBlogConfig();
  } catch (err) {
    log.warn({ err }, "[cron:blog] no se pudo leer blog_config, usando defaults");
    config = null;
  }

  if (!forzar && config && !debeEjecutarAhora(config)) {
    const ahora = new Date();
    log.info(
      { horaUTC: ahora.getUTCHours(), minUTC: ahora.getUTCMinutes(), horas: config.horas, minutos: config.minutos },
      "[cron:blog] fuera de horario, saltando",
    );
    return NextResponse.json({ ok: true, saltado: true, motivo: "fuera_de_horario" });
  }

  try {
    const resultado = await ejecutarGeneracionBlog({
      longitud: (config?.longitud ?? "medio") as "corto" | "medio" | "largo",
      tierPortada: (config?.tier_portada ?? "pro") as "pro" | "estandar",
      modoImagenes: (config?.modo_imagenes ?? "completo") as "sin-imagenes" | "solo-portada" | "completo",
    });
    return NextResponse.json(resultado);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "[cron:blog] falló generación");
    return NextResponse.json({ error: "Falló la generación", detalle: msg }, { status: 500 });
  }
}
