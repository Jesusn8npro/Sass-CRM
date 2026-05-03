"use client";

import { useState } from "react";
import type { LeadUI } from "./page";

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

interface Props {
  run: RunApifyUI;
  idCuenta: string;
  onAbrirLead: (lead: LeadUI) => void;
}

export function FilaRun({ run, idCuenta, onAbrirLead }: Props) {
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);
  const [leads, setLeads] = useState<LeadUI[] | null>(null);
  const [cargandoRes, setCargandoRes] = useState(false);

  const corriendo = run.estado === "corriendo";
  const completado = run.estado === "completado";
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
        resumen?: { items_recibidos: number; leads_guardados: number };
        mensaje?: string;
        error?: string;
      };
      if (!r.ok) {
        setMensaje(data.mensaje ?? data.error ?? "Error al sincronizar");
      } else if (data.todavia_corriendo) {
        setMensaje("Sigue corriendo en Apify, esperá unos segundos");
      } else if (data.resumen) {
        setMensaje(
          `✓ ${data.resumen.leads_guardados} leads guardados en bandeja`,
        );
      }
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSincronizando(false);
    }
  }

  async function cargarLeads(forzar = false) {
    if (cargandoRes || (!forzar && leads)) return;
    setCargandoRes(true);
    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/apify/runs/${run.id}/resultados`,
        { cache: "no-store" },
      );
      if (!r.ok) {
        setMensaje("No se pudieron cargar los resultados");
        return;
      }
      const data = (await r.json()) as { leads: LeadUI[] };
      setLeads(data.leads);
    } finally {
      setCargandoRes(false);
    }
  }

  function alternarExpandido() {
    const nuevo = !expandido;
    setExpandido(nuevo);
    if (nuevo && completado) void cargarLeads();
  }

  return (
    <li className="py-3">
      <div
        className={`flex items-center justify-between gap-3 ${completado ? "cursor-pointer" : ""}`}
        onClick={completado ? alternarExpandido : undefined}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {completado && (
              <span className="mr-1.5 text-zinc-400">
                {expandido ? "▾" : "▸"}
              </span>
            )}
            {busqueda} · {ubicacion}
          </p>
          <p className="text-[11px] text-zinc-500">
            {new Date(run.creado_en).toLocaleString("es")}
            {completado && ` · ${run.items_count} leads en bandeja`}
            {fallo && run.error && ` · ${run.error.slice(0, 80)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {corriendo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void sincronizar();
              }}
              disabled={sincronizando}
              className="rounded-full border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              {sincronizando ? "…" : "↻ Sincronizar"}
            </button>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              corriendo
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : completado
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
      {expandido && completado && (
        <ListaLeads
          leads={leads}
          cargando={cargandoRes}
          onAbrir={onAbrirLead}
        />
      )}
    </li>
  );
}

function ListaLeads({
  leads,
  cargando,
  onAbrir,
}: {
  leads: LeadUI[] | null;
  cargando: boolean;
  onAbrir: (lead: LeadUI) => void;
}) {
  if (cargando) {
    return (
      <p className="mt-3 px-3 text-xs text-zinc-500">Cargando leads…</p>
    );
  }
  if (!leads || leads.length === 0) {
    return (
      <p className="mt-3 px-3 text-xs text-zinc-500">Sin leads en bandeja.</p>
    );
  }
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {leads.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onAbrir(l)}
            className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
              l.importado
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-zinc-800"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-[10px] font-bold text-white">
              {l.nombre.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {l.nombre}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-500">
                {l.telefono && <span>📞 +{l.telefono}</span>}
                {l.email && <span>✉ {l.email}</span>}
                {l.categoria && <span>{l.categoria}</span>}
              </span>
            </span>
            {l.importado && (
              <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                ✓ En CRM
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
