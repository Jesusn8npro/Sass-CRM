"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ACTORS_DISPONIBLES,
  type DefinicionActor,
} from "@/lib/apify/actors";

interface RunApifyUI {
  id: string;
  actor_id: string;
  estado: "corriendo" | "completado" | "fallido" | "abortado";
  items_count: number;
  costo_creditos: number;
  error: string | null;
  creado_en: string;
  completado_en: string | null;
  input: { searchStringsArray?: string[]; locationQuery?: string };
}

interface RespuestaRuns {
  runs: RunApifyUI[];
}

export default function PaginaLeads() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [actor] = useState<DefinicionActor | null>(
    ACTORS_DISPONIBLES[0] ?? null,
  );
  const [busqueda, setBusqueda] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [maxResultados, setMaxResultados] = useState(20);
  const [lanzando, setLanzando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunApifyUI[]>([]);

  // Polling de runs cada 4s mientras haya alguno corriendo
  useEffect(() => {
    if (!idCuenta) return;
    let cancelado = false;
    async function cargar() {
      try {
        const r = await fetch(`/api/cuentas/${idCuenta}/apify/runs`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as RespuestaRuns;
        if (!cancelado) setRuns(d.runs);
      } catch {
        /* ignorar */
      }
    }
    cargar();
    const i = setInterval(cargar, 4000);
    return () => {
      cancelado = true;
      clearInterval(i);
    };
  }, [idCuenta]);

  async function lanzar(e: React.FormEvent) {
    e.preventDefault();
    if (!actor || lanzando) return;
    setLanzando(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/apify/buscar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor_id: actor.id,
            input: {
              busqueda: busqueda.trim(),
              ubicacion: ubicacion.trim(),
              maxResultados,
            },
          }),
        },
      );
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        mensaje?: string;
      };
      if (!r.ok || !data.ok) {
        setError(data.mensaje ?? data.error ?? `Error ${r.status}`);
      } else {
        setBusqueda("");
        setUbicacion("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLanzando(false);
    }
  }

  const costoEstimado = (actor?.creditosPorItem ?? 0) * maxResultados;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          Captación · Leads
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Buscar contactos potenciales
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Buscá en Google Maps por término + ciudad y conseguí nombre, teléfono,
          email y sitio web. Los contactos se importan a tu CRM.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:p-6">
        <form onSubmit={lanzar} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Qué buscás
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="restaurantes, veterinarias, abogados de familia…"
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Ciudad / país
            </label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Bogotá, Colombia"
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Máx resultados
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxResultados}
              onChange={(e) =>
                setMaxResultados(Math.max(1, Math.min(200, Number(e.target.value))))
              }
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Costo estimado:{" "}
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                {costoEstimado} créditos
              </span>{" "}
              (máx — solo se cobra por resultados reales)
            </p>
            <button
              type="submit"
              disabled={lanzando || !busqueda || !ubicacion}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
            >
              {lanzando ? "Lanzando…" : "Buscar leads"}
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">
          Búsquedas recientes ({runs.length})
        </h2>
        {runs.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Todavía no lanzaste ninguna búsqueda.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {runs.map((r) => (
              <FilaRun key={r.id} run={r} idCuenta={idCuenta} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FilaRun({ run, idCuenta }: { run: RunApifyUI; idCuenta: string }) {
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const corriendo = run.estado === "corriendo";
  const fallo = run.estado === "fallido" || run.estado === "abortado";
  const busqueda = run.input.searchStringsArray?.[0] ?? "(?)";
  const ubicacion = run.input.locationQuery ?? "(?)";

  async function sincronizar() {
    if (sincronizando) return;
    setSincronizando(true);
    setMensaje(null);
    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/apify/runs/${run.id}/sincronizar`,
        { method: "POST" },
      );
      const data = (await r.json()) as {
        ok?: boolean;
        todavia_corriendo?: boolean;
        ya_completado?: boolean;
        resumen?: { items_recibidos: number; emails_creados: number };
        mensaje?: string;
        error?: string;
      };
      if (!r.ok) {
        setMensaje(data.mensaje ?? data.error ?? "Error al sincronizar");
      } else if (data.todavia_corriendo) {
        setMensaje("El run sigue corriendo en Apify, esperá unos segundos");
      } else if (data.resumen) {
        setMensaje(
          `✓ ${data.resumen.items_recibidos} resultados, ${data.resumen.emails_creados} emails nuevos`,
        );
      }
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {busqueda} · {ubicacion}
          </p>
          <p className="text-[11px] text-zinc-500">
            {new Date(run.creado_en).toLocaleString("es")}
            {run.estado === "completado" &&
              ` · ${run.items_count} resultados importados`}
            {fallo && run.error && ` · ${run.error.slice(0, 80)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {corriendo && (
            <button
              type="button"
              onClick={sincronizar}
              disabled={sincronizando}
              title="Consultar a Apify si ya terminó (cuando el webhook no llegó)"
              className="rounded-full border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              {sincronizando ? "…" : "↻ Sincronizar"}
            </button>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              corriendo
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : run.estado === "completado"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {corriendo ? "⏳ Corriendo" : run.estado}
          </span>
        </div>
      </div>
      {mensaje && (
        <p className="mt-2 rounded-md bg-emerald-500/5 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
          {mensaje}
        </p>
      )}
    </li>
  );
}
