"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePollingVisible } from "@/components/usePollingVisible";

type NivelEvento = "info" | "warn" | "error" | "critical";

interface EventoLog {
  id: string;
  cuenta_id: string | null;
  nivel: NivelEvento;
  contexto: string;
  mensaje: string;
  metadata: Record<string, unknown> | null;
  creado_en: string;
}

interface RespuestaLogs {
  eventos: EventoLog[];
  total: number;
}

interface CuentaMin {
  id: string;
  etiqueta: string;
}

const NIVELES: { valor: "" | NivelEvento; label: string }[] = [
  { valor: "", label: "todos los niveles" },
  { valor: "critical", label: "critical" },
  { valor: "error", label: "error" },
  { valor: "warn", label: "warn" },
  { valor: "info", label: "info" },
];

const PAGE_SIZE = 100;

export default function PaginaAdminLogs() {
  const [eventos, setEventos] = useState<EventoLog[]>([]);
  const [total, setTotal] = useState(0);
  const [cuentas, setCuentas] = useState<CuentaMin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nivel, setNivel] = useState<"" | NivelEvento>("");
  const [cuentaId, setCuentaId] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(PAGE_SIZE);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (nivel) params.set("nivel", nivel);
      if (cuentaId) params.set("cuenta_id", cuentaId);
      params.set("limite", String(limite));
      const res = await fetch(`/api/admin/logs?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaLogs;
      setEventos(data.eventos);
      setTotal(data.total);
    } finally {
      setCargando(false);
    }
  }, [nivel, cuentaId, limite]);

  // Cargar lista de cuentas una sola vez
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/cuentas", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { cuentas: CuentaMin[] };
        setCuentas(data.cuentas);
      } catch {
        /* ignorar */
      }
    })();
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Auto-refresh cada 30s, pausado cuando el tab no está visible
  usePollingVisible(cargar, 30_000, autoRefresh);

  const eventosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return eventos;
    return eventos.filter(
      (e) =>
        e.contexto.toLowerCase().includes(q) ||
        e.mensaje.toLowerCase().includes(q),
    );
  }, [eventos, busqueda]);

  const cuentasMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cuentas) m.set(c.id, c.etiqueta);
    return m;
  }, [cuentas]);

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // logs del sistema
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Eventos del bot
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-white/60">
          Errores, warnings y eventos críticos del bot Baileys + procesadores.
          Visibilidad operativa sin tener que ir a EasyPanel.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value as "" | NivelEvento)}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 font-mono text-xs uppercase tracking-wider text-zinc-900 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white"
        >
          {NIVELES.map((n) => (
            <option
              key={n.valor || "todos"}
              value={n.valor}
              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white"
            >
              {n.label}
            </option>
          ))}
        </select>

        <select
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 font-mono text-xs uppercase tracking-wider text-zinc-900 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white"
        >
          <option
            value=""
            className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white"
          >
            todas las cuentas
          </option>
          {cuentas.map((c) => (
            <option
              key={c.id}
              value={c.id}
              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white"
            >
              {c.etiqueta}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por contexto o mensaje…"
          className="flex-1 min-w-[200px] rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white dark:placeholder:text-white/30 dark:focus:border-emerald-400/50"
        />

        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-white dark:text-black dark:hover:bg-emerald-300"
        >
          Refrescar
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-zinc-700 dark:text-white/70">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-white/20"
          />
          auto 10s
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Nivel</th>
              <th className="px-4 py-3">Contexto</th>
              <th className="px-4 py-3">Mensaje</th>
              <th className="px-4 py-3">Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {cargando && eventos.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-white/40"
                >
                  Cargando…
                </td>
              </tr>
            ) : eventosFiltrados.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-white/40"
                >
                  Sin eventos
                </td>
              </tr>
            ) : (
              eventosFiltrados.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-t border-zinc-100 align-top transition-colors hover:bg-zinc-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                    {formatearFecha(ev.creado_en)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={pillNivel(ev.nivel)}>{ev.nivel}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-700 dark:text-white/80">
                    {ev.contexto}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-white/90">
                    <p className="break-words">{ev.mensaje}</p>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] text-zinc-500 dark:text-white/40">
                        {JSON.stringify(ev.metadata)}
                      </pre>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                    {ev.cuenta_id
                      ? cuentasMap.get(ev.cuenta_id) ?? ev.cuenta_id.slice(0, 8)
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-zinc-500 dark:text-white/50">
        <span>
          mostrando {eventosFiltrados.length} de {total} eventos
          {busqueda && ` (filtro local: "${busqueda}")`}
        </span>
        {eventos.length >= limite && total > limite && (
          <button
            type="button"
            onClick={() => setLimite((l) => Math.min(500, l + PAGE_SIZE))}
            disabled={limite >= 500}
            className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-700 hover:border-zinc-400 disabled:opacity-40 dark:border-white/[0.10] dark:text-white/80 dark:hover:border-white/30"
          >
            cargar más
          </button>
        )}
      </div>
    </div>
  );
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function pillNivel(nivel: NivelEvento): string {
  const base =
    "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider";
  if (nivel === "critical")
    return `${base} border-red-500/60 bg-red-100 text-red-800 dark:border-red-400/40 dark:bg-red-400/[0.12] dark:text-red-200`;
  if (nivel === "error")
    return `${base} border-orange-500/40 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/[0.08] dark:text-orange-200`;
  if (nivel === "warn")
    return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/70`;
}
