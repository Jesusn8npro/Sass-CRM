"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ACTORS_DISPONIBLES,
  type DefinicionActor,
} from "@/lib/apify/actors";
import { LeadDetalleModal } from "./_modal";
import { FilaRun } from "./_filaRun";

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

export interface LeadUI {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  sitio_web: string | null;
  categoria: string | null;
  raw: Record<string, unknown>;
  importado: boolean;
  conversacion_id: string | null;
  creado_en: string;
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
  const [leadAbierto, setLeadAbierto] = useState<LeadUI | null>(null);

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
          Buscá en Google Maps por término + ciudad. Los resultados quedan en
          una bandeja — vos decidís cuáles importar al CRM.
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
                setMaxResultados(
                  Math.max(1, Math.min(200, Number(e.target.value))),
                )
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
              <FilaRun
                key={r.id}
                run={r}
                idCuenta={idCuenta}
                onAbrirLead={(lead) => setLeadAbierto(lead)}
              />
            ))}
          </ul>
        )}
      </section>

      <LeadDetalleModal
        idCuenta={idCuenta}
        lead={leadAbierto}
        onCerrar={() => setLeadAbierto(null)}
        onImportado={(conversacionId) => {
          setLeadAbierto((prev) =>
            prev
              ? { ...prev, importado: true, conversacion_id: conversacionId }
              : prev,
          );
        }}
      />
    </div>
  );
}
