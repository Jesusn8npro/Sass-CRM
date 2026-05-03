"use client";

import type { FilaCliente, FiltroEstado } from "./_componentes";
import { ESTADOS, StatCard } from "./_componentes";

interface Stats {
  total: number;
  calificados: number;
  negociacion: number;
  cerrados: number;
  perdidos: number;
}

export function HeroClientes({
  filas,
  filtradas,
  filtro,
  setFiltro,
  exportarCSV,
  stats,
  estadoFiltro,
  setEstadoFiltro,
  conteoPorEstado,
}: {
  filas: FilaCliente[];
  filtradas: FilaCliente[];
  filtro: string;
  setFiltro: (v: string) => void;
  exportarCSV: () => void;
  stats: Stats;
  estadoFiltro: FiltroEstado;
  setEstadoFiltro: (v: FiltroEstado) => void;
  conteoPorEstado: Map<FiltroEstado, number>;
}) {
  return (
      <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-white via-emerald-50/30 to-white px-6 pt-6 pb-4 dark:border-zinc-800 dark:from-zinc-950 dark:via-emerald-950/10 dark:to-zinc-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-lg text-white shadow-md">
                <span aria-hidden>👥</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {filas.length} contacto{filas.length === 1 ? "" : "s"}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  CRM de Clientes
                </h1>
                <p className="text-xs text-zinc-500">
                  Gestiona y visualiza todos tus contactos en un solo lugar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  ⌕
                </span>
                <input
                  type="text"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="w-64 rounded-full border border-zinc-200 bg-white py-1.5 pl-9 pr-4 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
                />
              </div>
              <button
                type="button"
                onClick={exportarCSV}
                disabled={filtradas.length === 0}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all hover:-translate-y-px hover:border-emerald-500/30 hover:shadow-md disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
              >
                ↓ Exportar
              </button>
            </div>
          </div>

          {/* 5 stat cards estilo Talos */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="Total"
              value={stats.total}
              hint="contactos"
              icon="👥"
              accent="zinc"
            />
            <StatCard
              label="Calificados"
              value={stats.calificados}
              hint="listos para avanzar"
              icon="◎"
              accent="violet"
            />
            <StatCard
              label="Negociación"
              value={stats.negociacion}
              hint="en proceso"
              icon="⚙"
              accent="amber"
            />
            <StatCard
              label="Cerrados"
              value={stats.cerrados}
              hint="¡Ganados!"
              icon="🏆"
              accent="emerald"
            />
            <StatCard
              label="Perdidos"
              value={stats.perdidos}
              hint="oportunidades"
              icon="✗"
              accent="red"
            />
          </div>

          {/* Buscador móvil */}
          <div className="mb-3 md:hidden">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                ⌕
              </span>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
          </div>

          {/* Filtros pill por estado */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Filtrar:
            </span>
            {ESTADOS.map((e) => {
              const activo = estadoFiltro === e.id;
              const count = conteoPorEstado.get(e.id) ?? 0;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEstadoFiltro(e.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                    activo
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                      : "border border-zinc-200 bg-white text-zinc-600 hover:border-emerald-500/40 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {e.label}
                  {count > 0 && (
                    <span className="ml-1.5 font-mono text-[9px] opacity-60">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="ml-auto text-[11px] font-mono text-zinc-500">
              {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </header>
  );
}
