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

type ModoContacto = "ambos" | "solo_llamadas" | "solo_email";

const MODOS: { value: ModoContacto; label: string; icon: string }[] = [
  { value: "ambos",        label: "Llamada → Email",  icon: "📞✉" },
  { value: "solo_llamadas", label: "Solo llamadas",    icon: "📞" },
  { value: "solo_email",    label: "Solo email",       icon: "✉" },
];

export function FilaRun({ run, idCuenta, onAbrirLead }: Props) {
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [leads, setLeads] = useState<LeadUI[] | null>(null);
  const [cargandoRes, setCargandoRes] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [modo, setModo] = useState<ModoContacto>("ambos");
  const [mostrarModos, setMostrarModos] = useState(false);

  const corriendo = run.estado === "corriendo";
  const completado = run.estado === "completado";
  const fallo = run.estado === "fallido" || run.estado === "abortado";

  const raw = run.input as Record<string, unknown>;
  const busqueda =
    (raw.searchStringsArray as string[] | undefined)?.[0] ??
    (raw.busqueda as string | undefined) ??
    (raw.query as string | undefined) ??
    "Sin término";
  const ubicacion =
    (raw.locationQuery as string | undefined) ??
    (raw.ubicacion as string | undefined) ??
    (raw.location as string | undefined) ??
    "Sin ubicación";

  async function sincronizar() {
    if (sincronizando) return;
    setSincronizando(true);
    setMensaje(null);
    setMensajeError(false);
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
        setMensajeError(true);
      } else if (data.todavia_corriendo) {
        setMensaje("Sigue corriendo en Apify, esperá unos segundos");
      } else if (data.resumen) {
        setMensaje(`✓ ${data.resumen.leads_guardados} leads guardados en bandeja`);
      }
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error de red");
      setMensajeError(true);
    } finally {
      setSincronizando(false);
    }
  }

  async function iniciarPipeline() {
    if (iniciando) return;
    setIniciando(true);
    setMensaje(null);
    setMensajeError(false);
    setMostrarModos(false);
    try {
      const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/iniciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, modo }),
      });
      const data = (await r.json()) as { ok?: boolean; mensaje?: string; error?: string };
      if (!r.ok || !data.ok) {
        setMensaje(data.error ?? data.mensaje ?? "Error al iniciar");
        setMensajeError(true);
      } else {
        setMensaje(data.mensaje ?? "Pipeline iniciado");
        setMensajeError(false);
      }
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error de red");
      setMensajeError(true);
    } finally {
      setIniciando(false);
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
      if (!r.ok) { setMensaje("No se pudieron cargar los resultados"); return; }
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

  const modoActual = MODOS.find((m) => m.value === modo)!;

  return (
    <li className="py-3">
      <div
        className={`flex items-center justify-between gap-3 ${completado ? "cursor-pointer" : ""}`}
        onClick={completado ? alternarExpandido : undefined}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {completado && (
              <span className="mr-1.5 text-zinc-400">{expandido ? "▾" : "▸"}</span>
            )}
            {busqueda} · {ubicacion}
          </p>
          <p className="text-[11px] text-zinc-500">
            {new Date(run.creado_en).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
            {completado && ` · ${run.items_count} leads en bandeja`}
            {fallo && run.error && ` · ${run.error.slice(0, 80)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {corriendo && (
            <button
              type="button"
              onClick={() => void sincronizar()}
              disabled={sincronizando}
              className="rounded-full border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
            >
              {sincronizando ? "…" : "↻ Sincronizar"}
            </button>
          )}
          {completado && run.items_count > 0 && (
            <div className="relative">
              {/* Selector de modo */}
              {mostrarModos && (
                <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {MODOS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => { setModo(m.value); setMostrarModos(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium first:rounded-t-xl last:rounded-b-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 ${modo === m.value ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-300"}`}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                      {modo === m.value && <span className="ml-auto text-emerald-500">✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center overflow-hidden rounded-full border border-emerald-500/40">
                <button
                  type="button"
                  onClick={() => void iniciarPipeline()}
                  disabled={iniciando}
                  className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-400/[0.08] dark:text-emerald-300 dark:hover:bg-emerald-400/[0.14]"
                >
                  {iniciando ? "⏳ Iniciando…" : `🚀 ${modoActual.icon} Iniciar`}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModos((v) => !v)}
                  className="border-l border-emerald-500/30 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-400/[0.08] dark:text-emerald-300 dark:hover:bg-emerald-400/[0.14]"
                  title="Cambiar modo de contacto"
                >
                  ▾
                </button>
              </div>
            </div>
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
        <p className={`mt-2 rounded-md px-2 py-1 text-[11px] ${mensajeError ? "bg-red-500/5 text-red-700 dark:text-red-300" : "bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"}`}>
          {mensaje}
        </p>
      )}
      {expandido && completado && (
        <ListaLeads
          leads={leads}
          cargando={cargandoRes}
          onAbrir={onAbrirLead}
          onReimportar={async () => {
            await sincronizar();
            setLeads(null);
            await cargarLeads(true);
          }}
          reimportando={sincronizando}
        />
      )}
    </li>
  );
}

function ListaLeads({
  leads,
  cargando,
  onAbrir,
  onReimportar,
  reimportando,
}: {
  leads: LeadUI[] | null;
  cargando: boolean;
  onAbrir: (lead: LeadUI) => void;
  onReimportar: () => void;
  reimportando: boolean;
}) {
  if (cargando) {
    return <p className="mt-3 px-3 text-xs text-zinc-500">Cargando leads…</p>;
  }
  if (!leads || leads.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Sin leads en bandeja</p>
        <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
          Este run terminó antes del cambio de flow o falló al guardar. Si Apify
          todavía tiene el dataset (lo guarda 7 días), podés re-importarlo.
        </p>
        <button
          type="button"
          onClick={onReimportar}
          disabled={reimportando}
          className="mt-2 rounded-full border border-emerald-500/40 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
        >
          {reimportando ? "Re-importando…" : "↻ Re-importar de Apify"}
        </button>
      </div>
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
              <span className="block truncate font-semibold">{l.nombre}</span>
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
