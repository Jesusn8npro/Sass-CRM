import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db/cliente";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron diario que publica borradores programados.
 *
 * Prioridad:
 *   1. Borradores con `programado_para <= now()` (más antiguo primero).
 *   2. Si no hay ninguno programado, publica el borrador más viejo como
 *      fallback (así siempre sale al menos 1 artículo/día si hay stock).
 *
 * Configurable via env:
 *   BLOG_MAX_POR_DIA  — máximo de artículos a publicar por ejecución (default: 1)
 *
 * Protegido por header `x-cron-secret`.
 */
export async function POST(request: NextRequest) {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) {
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 500 });
  }
  if (request.headers.get("x-cron-secret") !== esperado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const maxPorDia = Math.max(1, parseInt(process.env.BLOG_MAX_POR_DIA ?? "1", 10));
  const ahora = new Date().toISOString();

  // 1. Buscar borradores con programado_para <= ahora
  const { data: programados, error: err1 } = await db()
    .from("articulos_blog")
    .select("id, titulo")
    .eq("estado", "borrador")
    .not("programado_para", "is", null)
    .lte("programado_para", ahora)
    .order("programado_para", { ascending: true })
    .limit(maxPorDia);

  if (err1) {
    log.error({ err: err1.message }, "[cron/publicar-borradores] error consultando programados");
    return NextResponse.json({ error: err1.message }, { status: 500 });
  }

  let candidatos = (programados ?? []) as { id: string; titulo: string }[];

  // 2. Fallback: borrador más viejo sin programar
  if (candidatos.length === 0) {
    const { data: fallback, error: err2 } = await db()
      .from("articulos_blog")
      .select("id, titulo")
      .eq("estado", "borrador")
      .is("programado_para", null)
      .order("creado_en", { ascending: true })
      .limit(maxPorDia);

    if (err2) {
      log.error({ err: err2.message }, "[cron/publicar-borradores] error consultando fallback");
      return NextResponse.json({ error: err2.message }, { status: 500 });
    }
    candidatos = (fallback ?? []) as { id: string; titulo: string }[];
  }

  if (candidatos.length === 0) {
    log.info("[cron/publicar-borradores] sin borradores para publicar");
    return NextResponse.json({ ok: true, publicados: 0, mensaje: "Sin borradores disponibles" });
  }

  const resultados: { id: string; titulo: string; ok: boolean }[] = [];

  for (const art of candidatos) {
    const { error: errPub } = await db()
      .from("articulos_blog")
      .update({ estado: "publicado", publicado_en: new Date().toISOString() })
      .eq("id", art.id);

    const ok = !errPub;
    if (!ok) log.error({ err: errPub?.message, id: art.id }, "[cron/publicar-borradores] error publicando");
    else log.info({ id: art.id, titulo: art.titulo }, "[cron/publicar-borradores] artículo publicado");

    resultados.push({ id: art.id, titulo: art.titulo, ok });
  }

  const publicados = resultados.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, publicados, detalle: resultados });
}
