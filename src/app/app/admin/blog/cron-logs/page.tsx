"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { usePollingVisible } from "@/components/usePollingVisible";

interface CronStatus {
  corriendo: boolean;
  status: {
    arrancoEn: number;
    ultimoChequeo: number | null;
    ultimoChequeoResultado: "disparó" | "fuera-horario" | "cooldown" | "desactivado" | null;
    ultimaGenEn: number | null;
    chequeosTotales: number;
    ultimoChequeoCtx: {
      horaUTC: number; minUTC: number; diaUTC: number;
      configHoras: number[]; configMinutos: number; configDias: number[];
      configActivo: boolean;
    } | null;
  } | null;
  ahoraUTC: { hora: number; minuto: number; dia: number; iso: string };
}

interface CronRun {
  id: string;
  ejecutado_en: string;
  resultado: "publicado" | "error" | "saltado";
  disparado_por: "cron" | "manual";
  slug_articulo: string | null;
  titulo_articulo: string | null;
  categoria: string | null;
  ms_total: number | null;
  error_mensaje: string | null;
}

function formatMs(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const PILL: Record<string, string> = {
  publicado: "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300",
  error:     "border-red-500/60 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-400/10 dark:text-red-300",
  saltado:   "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50",
};

const ICON: Record<string, string> = {
  publicado: "✓",
  error: "✗",
  saltado: "—",
};

const DIAS_NOMBRE = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function PaginaCronLogs() {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [arrancando, setArrancando] = useState(false);
  const [msgArranque, setMsgArranque] = useState<string | null>(null);
  const [limpiando, setLimpiando] = useState(false);
  const [msgLimpieza, setMsgLimpieza] = useState<string | null>(null);

  interface PendingSlot { savedAt: number; horas: number[]; minutos: number; dias: number[] }
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("blog_pending_slot");
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as PendingSlot;
      if (Date.now() - p.savedAt < 2 * 3600_000) setPendingSlot(p);
      else localStorage.removeItem("blog_pending_slot");
    } catch { localStorage.removeItem("blog_pending_slot"); }
  }, []);

  useEffect(() => {
    if (!pendingSlot) return;
    const cumplido = runs.find(
      (r) => r.resultado === "publicado" && new Date(r.ejecutado_en).getTime() > pendingSlot.savedAt
    );
    if (cumplido) {
      setPendingSlot(null);
      localStorage.removeItem("blog_pending_slot");
    }
  }, [runs, pendingSlot]);

  const cargar = useCallback(async () => {
    try {
      const [rLogs, rStatus] = await Promise.all([
        fetch("/api/admin/blog/cron-logs", { cache: "no-store" }),
        fetch("/api/admin/blog/cron-status", { cache: "no-store" }),
      ]);
      if (rLogs.ok) {
        const d = await rLogs.json() as { runs: CronRun[] };
        setRuns(d.runs);
      }
      if (rStatus.ok) {
        setCronStatus(await rStatus.json() as CronStatus);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  usePollingVisible(cargar, 60_000);

  async function arrancarCron() {
    setArrancando(true);
    setMsgArranque(null);
    try {
      const r = await fetch("/api/admin/blog/reiniciar-cron", { method: "POST" });
      const d = await r.json() as { ok: boolean; mensaje: string };
      setMsgArranque(d.mensaje);
      await cargar();
    } catch {
      setMsgArranque("Error al arrancar");
    } finally {
      setArrancando(false);
    }
  }

  async function limpiarSlots() {
    setLimpiando(true);
    setMsgLimpieza(null);
    try {
      const r = await fetch("/api/admin/blog/limpiar-slots", { method: "POST" });
      const d = await r.json() as { ok: boolean; slotsLimpiados: number };
      setMsgLimpieza(`✓ Slots liberados (${d.slotsLimpiados} horarios). El cron puede volver a disparar.`);
      await cargar();
    } catch {
      setMsgLimpieza("Error al limpiar");
    } finally {
      setLimpiando(false);
    }
  }

  const publicados = runs.filter((r) => r.resultado === "publicado").length;
  const errores    = runs.filter((r) => r.resultado === "error").length;
  const ultimoRun  = runs[0];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
              // blog → cron
            </p>
            <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white">
              Logs de generación
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-white/50">
              Historial de ejecuciones automáticas y manuales del generador de artículos.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/admin/blog"
              className="rounded-full border border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-700 hover:border-zinc-400 dark:border-white/15 dark:text-white/70"
            >
              ← Blog
            </Link>
            <Link
              href="/app/admin/blog/configuracion"
              className="rounded-full border border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-700 hover:border-zinc-400 dark:border-white/15 dark:text-white/70"
            >
              ⚙ Config
            </Link>
          </div>
        </div>
      </header>

      {/* Panel diagnóstico del cron */}
      {cronStatus && (
        <div className={`mb-6 rounded-2xl border p-5 ${cronStatus.corriendo ? "border-emerald-500/40 bg-emerald-400/[0.04]" : "border-red-500/40 bg-red-400/[0.04]"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
                // estado del cron en proceso
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${cronStatus.corriendo ? "animate-pulse bg-emerald-400" : "bg-red-400"}`} />
                  <span className={`font-mono text-sm font-bold ${cronStatus.corriendo ? "text-emerald-400" : "text-red-400"}`}>
                    {cronStatus.corriendo ? "Cron activo" : "Cron NO detectado"}
                  </span>
                </div>
                {!cronStatus.corriendo && (
                  <button
                    type="button"
                    onClick={() => void arrancarCron()}
                    disabled={arrancando}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {arrancando ? "Arrancando…" : "▶ Arrancar ahora"}
                  </button>
                )}
                {msgArranque && (
                  <span className="font-mono text-[11px] text-emerald-400">{msgArranque} — espera 60s para el primer chequeo</span>
                )}
              </div>
              {cronStatus.status && (
                <div className="mt-3 space-y-1 font-mono text-[11px] text-zinc-500 dark:text-white/40">
                  <p>Arrancó: {new Date(cronStatus.status.arrancoEn).toLocaleString("es")}</p>
                  <p>Chequeos totales: <span className="text-zinc-800 dark:text-zinc-200">{cronStatus.status.chequeosTotales}</span></p>
                  <p>Último chequeo: <span className="text-zinc-800 dark:text-zinc-200">{cronStatus.status.ultimoChequeo ? new Date(cronStatus.status.ultimoChequeo).toLocaleString("es") : "—"}</span></p>
                  <p>Resultado: <span className={`font-bold ${cronStatus.status.ultimoChequeoResultado === "disparó" ? "text-emerald-600 dark:text-emerald-400" : cronStatus.status.ultimoChequeoResultado === "fuera-horario" ? "text-amber-600 dark:text-amber-400" : cronStatus.status.ultimoChequeoResultado === "cooldown" ? "text-orange-500" : "text-zinc-500"}`}>
                    {cronStatus.status.ultimoChequeoResultado ?? "—"}
                    {cronStatus.status.ultimoChequeoResultado === "cooldown" && " (slot ya disparó hoy)"}
                  </span></p>
                </div>
              )}

              {/* Botón limpiar slots */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void limpiarSlots()}
                  disabled={limpiando}
                  className="rounded-full border border-orange-400/60 bg-orange-50 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-orange-700 transition hover:bg-orange-100 disabled:opacity-60 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-300"
                >
                  {limpiando ? "Liberando…" : "↺ Liberar slots de hoy"}
                </button>
                {msgLimpieza && (
                  <span className="font-mono text-[11px] text-emerald-500">{msgLimpieza}</span>
                )}
              </div>
              <p className="mt-2 font-mono text-[10px] text-zinc-400 dark:text-white/25">
                Cada horario se dispara una vez por día. Si dice &quot;cooldown&quot;, presioná ↺ para que pueda volver a disparar.
              </p>
            </div>

            {/* Diagnóstico UTC — columna derecha */}
            {cronStatus.status?.ultimoChequeoCtx && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-[11px] dark:border-white/[0.06] dark:bg-white/[0.02]">
                <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Diagnóstico último chequeo</p>
                <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                  <p>Hora Bogotá ahora: <strong className="text-zinc-900 dark:text-white">{cronStatus.ahoraUTC.hora.toString().padStart(2,"0")}:{cronStatus.ahoraUTC.minuto.toString().padStart(2,"0")}</strong> (día {DIAS_NOMBRE[cronStatus.ahoraUTC.dia]})</p>
                  <p>Hora en chequeo: <span className="text-zinc-700 dark:text-zinc-300">{cronStatus.status.ultimoChequeoCtx.horaUTC.toString().padStart(2,"0")}:{cronStatus.status.ultimoChequeoCtx.minUTC.toString().padStart(2,"0")} Bogotá</span></p>
                  <p>Horas config: <span className={`${cronStatus.status.ultimoChequeoCtx.configHoras.includes(cronStatus.status.ultimoChequeoCtx.horaUTC) ? "text-emerald-400" : "text-red-400"}`}>
                    [{cronStatus.status.ultimoChequeoCtx.configHoras.map(h => h.toString().padStart(2,"0")+"h").join(", ")}]
                    {" "}{cronStatus.status.ultimoChequeoCtx.configHoras.includes(cronStatus.status.ultimoChequeoCtx.horaUTC) ? "✓" : "✗ espera la hora configurada"}
                  </span></p>
                  <p>Minuto config: <span className={`${Math.abs(cronStatus.status.ultimoChequeoCtx.minUTC - cronStatus.status.ultimoChequeoCtx.configMinutos) <= 15 ? "text-emerald-400" : "text-red-400"}`}>
                    {cronStatus.status.ultimoChequeoCtx.configMinutos} (actual: {cronStatus.status.ultimoChequeoCtx.minUTC})
                    {" "}{Math.abs(cronStatus.status.ultimoChequeoCtx.minUTC - cronStatus.status.ultimoChequeoCtx.configMinutos) <= 15 ? "✓" : `✗ diferencia ${Math.abs(cronStatus.status.ultimoChequeoCtx.minUTC - cronStatus.status.ultimoChequeoCtx.configMinutos)} min (máx 15)`}
                  </span></p>
                  <p>Días config: <span className={`${cronStatus.status.ultimoChequeoCtx.configDias.includes(cronStatus.status.ultimoChequeoCtx.diaUTC) ? "text-emerald-400" : "text-red-400"}`}>
                    [{cronStatus.status.ultimoChequeoCtx.configDias.map(d => DIAS_NOMBRE[d]).join(", ")}]
                    {" "}{cronStatus.status.ultimoChequeoCtx.configDias.includes(cronStatus.status.ultimoChequeoCtx.diaUTC) ? "✓ día habilitado" : "✗ hoy no está en días"}
                  </span></p>
                  <p>Activo: <span className={cronStatus.status.ultimoChequeoCtx.configActivo ? "text-emerald-400" : "text-red-400"}>
                    {cronStatus.status.ultimoChequeoCtx.configActivo ? "✓ sí" : "✗ desactivado"}
                  </span></p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">Total runs</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{runs.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">Publicados</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{publicados}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">Errores</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{errores}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">Último run</p>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-700 dark:text-white/80">
            {ultimoRun ? formatFecha(ultimoRun.ejecutado_en) : "—"}
          </p>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Fecha (hora local)</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Disparado por</th>
              <th className="px-4 py-3">Artículo</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {pendingSlot && (
              <tr className="border-t border-amber-200/60 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/[0.04]">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                  {new Date(pendingSlot.savedAt).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  <span className="ml-1 text-amber-600 dark:text-amber-400">(guardado)</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    pendiente
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-white/40">🤖 cron</span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/40">
                  Programado:{" "}
                  {pendingSlot.horas.map((h) => {
                    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                    return `${h12}:${String(pendingSlot.minutos).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
                  }).join(", ")}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-zinc-400 dark:text-white/30">—</td>
                <td className="px-4 py-3 font-mono text-[11px] text-zinc-400 dark:text-white/30">—</td>
              </tr>
            )}
            {cargando && runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-mono text-[11px] text-zinc-400">
                  Cargando…
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="font-mono text-[11px] text-zinc-400 dark:text-white/30">
                    Sin registros aún.
                  </p>
                  <p className="mt-2 text-xs text-zinc-400 dark:text-white/25">
                    Aplicá la migración 35 en Supabase y reiniciá el servidor.
                    Los runs aparecerán aquí en cuanto el cron dispare o uses "⚡ Generar ahora".
                  </p>
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-zinc-100 align-top dark:border-white/[0.04]"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                    {formatFecha(run.ejecutado_en)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${PILL[run.resultado]}`}>
                      {ICON[run.resultado]} {run.resultado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[11px] ${run.disparado_por === "manual" ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-white/40"}`}>
                      {run.disparado_por === "manual" ? "👤 manual" : "🤖 cron"}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {run.slug_articulo ? (
                      <div>
                        <Link
                          href={`/blog/${run.slug_articulo}`}
                          target="_blank"
                          className="text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          {run.titulo_articulo ?? run.slug_articulo}
                        </Link>
                        <p className="font-mono text-[10px] text-zinc-400 dark:text-white/30">
                          /blog/{run.slug_articulo}
                        </p>
                      </div>
                    ) : run.error_mensaje ? (
                      <p className="font-mono text-[10px] text-red-500 dark:text-red-400 break-words">
                        {run.error_mensaje}
                      </p>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                    {run.categoria ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                    {formatMs(run.ms_total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 font-mono text-[10px] text-zinc-400 dark:text-white/25">
        Se actualiza cada 15 segundos · Últimos 100 registros · hora local del servidor
      </p>
    </div>
  );
}
