import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth/sesion";
import type { CronBlogStatus } from "@/instrumentation";

export const dynamic = "force-dynamic";

const _g = global as typeof global & {
  __cronBlogActivo?: boolean;
  __cronBlogStatus?: CronBlogStatus;
  __cronBlogSlotsHoy?: Set<string>;
  __cronBlogDiaHoy?: number;
};

export async function POST() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;

  if (_g.__cronBlogActivo) {
    return NextResponse.json({ ok: true, mensaje: "El cron ya estaba corriendo" });
  }

  _g.__cronBlogActivo = true;
  _g.__cronBlogStatus = {
    activo: true,
    arrancoEn: Date.now(),
    ultimoChequeo: null,
    ultimoChequeoResultado: null,
    ultimaGenEn: null,
    chequeosTotales: 0,
    ultimoChequeoCtx: null,
  };

  const INTERVALO_MS = 60_000;

  async function verificarYGenerar() {
    const s = _g.__cronBlogStatus!;
    s.ultimoChequeo = Date.now();
    s.chequeosTotales++;
    try {
      const { obtenerBlogConfig, debeEjecutarAhora, horaBogota } = await import("@/lib/db/blogConfig");
      const config = await obtenerBlogConfig();
      const { hora: horaLocal, min: minLocal, dia: diaLocal } = horaBogota();
      s.ultimoChequeoCtx = {
        horaUTC: horaLocal,
        minUTC: minLocal,
        diaUTC: diaLocal,
        configHoras: config.horas,
        configMinutos: config.minutos ?? 0,
        configDias: config.dias_semana,
        configActivo: config.activo,
      };
      console.log(`[cron:blog] chequeo #${s.chequeosTotales} ${horaLocal.toString().padStart(2,"0")}:${minLocal.toString().padStart(2,"0")} Bogota | activo=${config.activo} | horas=[${config.horas}] | minutos=${config.minutos ?? "?"} | dia=${diaLocal} | diasConfig=[${config.dias_semana}]`);
      if (!config.activo) { s.ultimoChequeoResultado = "desactivado"; return; }
      if (!debeEjecutarAhora(config)) { s.ultimoChequeoResultado = "fuera-horario"; return; }

      const diaHoy = Math.floor((Date.now() - 5 * 3600_000) / 86_400_000);
      if (_g.__cronBlogDiaHoy !== diaHoy) {
        _g.__cronBlogDiaHoy = diaHoy;
        _g.__cronBlogSlotsHoy = new Set();
      }
      const slotKey = `${horaLocal}:${config.minutos ?? 0}`;
      if (_g.__cronBlogSlotsHoy?.has(slotKey)) {
        s.ultimoChequeoResultado = "cooldown";
        return;
      }

      s.ultimoChequeoResultado = "disparó";
      s.ultimaGenEn = Date.now();
      _g.__cronBlogSlotsHoy ??= new Set();
      _g.__cronBlogSlotsHoy.add(slotKey);

      const { ejecutarGeneracionBlog } = await import("@/lib/blog/ejecutarGeneracion");
      const { registrarRunCron } = await import("@/lib/db/blogCronRuns");
      try {
        const r = await ejecutarGeneracionBlog({
          longitud: config.longitud,
          tierPortada: config.tier_portada,
          modoImagenes: config.modo_imagenes,
          temaManual: config.tema_manual ?? undefined,
        });
        void registrarRunCron({ resultado: "publicado", disparado_por: "cron", slug_articulo: r.slug, titulo_articulo: r.titulo, categoria: r.categoria, ms_total: r.ms_total, error_mensaje: null });
      } catch (genErr) {
        const msg = genErr instanceof Error ? genErr.message : String(genErr);
        _g.__cronBlogSlotsHoy?.delete(slotKey);
        void registrarRunCron({ resultado: "error", disparado_por: "cron", slug_articulo: null, titulo_articulo: null, categoria: null, ms_total: null, error_mensaje: msg });
      }
    } catch (err) {
      console.error("[cron:blog] error en verificación:", err);
    }
  }

  setTimeout(() => void verificarYGenerar(), 5_000);
  setInterval(() => void verificarYGenerar(), INTERVALO_MS);

  console.log("[cron:blog] arrancado manualmente vía API");
  return NextResponse.json({ ok: true, mensaje: "Cron arrancado correctamente" });
}
