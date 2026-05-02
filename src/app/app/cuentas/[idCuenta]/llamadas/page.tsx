"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Cuenta, EstadoLlamada, LlamadaVapi } from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";
import { LlamadasProgramadas } from "@/components/LlamadasProgramadas";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaLlamadas {
  llamadas: LlamadaVapi[];
}
interface RespuestaLlamada {
  llamada: LlamadaVapi;
}

const ETIQUETA_ESTADO: Record<EstadoLlamada, string> = {
  iniciando: "Iniciando",
  sonando: "Sonando",
  en_curso: "En curso",
  completada: "Completada",
  sin_respuesta: "Sin respuesta",
  fallida: "Fallida",
  finalizada: "Finalizada",
};

const COLOR_ESTADO: Record<EstadoLlamada, string> = {
  iniciando: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sonando: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  en_curso:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  completada:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  sin_respuesta:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  fallida: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  finalizada:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function formatearHora(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearDuracion(seg: number | null): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PaginaLlamadas() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [llamadas, setLlamadas] = useState<LlamadaVapi[]>([]);
  const [seleccionada, setSeleccionada] = useState<LlamadaVapi | null>(null);

  const cargarTodo = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const [resCuenta, resLlamadas] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/llamadas`, { cache: "no-store" }),
      ]);
      if (resCuenta.ok) {
        const d = (await resCuenta.json()) as RespuestaCuenta;
        setCuenta(d.cuenta);
      }
      if (resLlamadas.ok) {
        const d = (await resLlamadas.json()) as RespuestaLlamadas;
        setLlamadas(d.llamadas);
        // Si hay alguna seleccionada, refrescar su versión más nueva
        if (seleccionada) {
          const nueva = d.llamadas.find((l) => l.id === seleccionada.id);
          if (nueva) setSeleccionada(nueva);
        }
      }
    } catch (err) {
      console.error("[llamadas-page] error:", err);
    }
  }, [idCuenta, seleccionada]);

  useEffect(() => {
    cargarTodo();
    const t = setInterval(cargarTodo, 5000);
    return () => clearInterval(t);
  }, [cargarTodo]);

  async function refrescarDetalle(id: string) {
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/llamadas/${id}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const d = (await res.json()) as RespuestaLlamada;
        setSeleccionada(d.llamada);
        setLlamadas((prev) =>
          prev.map((l) => (l.id === d.llamada.id ? d.llamada : l)),
        );
      }
    } catch {
      // ignorar
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Llamadas
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/cuentas/${idCuenta}/dashboard`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Dashboard
            </Link>
            <Link
              href={`/app/cuentas/${idCuenta}/configuracion`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Ajustes
            </Link>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <LlamadasProgramadas idCuenta={idCuenta} />
        {llamadas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aún no hay llamadas
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Configurá Vapi en Ajustes y usá el botón Llamar en cualquier
              conversación. Las llamadas, transcripciones y grabaciones
              aparecen acá.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_2fr]">
            {/* Lista */}
            <div className="flex flex-col gap-2">
              {llamadas.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSeleccionada(l)}
                  className={`group rounded-2xl border bg-white p-3 text-left transition-colors dark:bg-zinc-900 ${
                    seleccionada?.id === l.id
                      ? "border-emerald-500/60 ring-2 ring-emerald-500/20"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      +{l.telefono}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        COLOR_ESTADO[l.estado] ?? COLOR_ESTADO.iniciando
                      }`}
                    >
                      {ETIQUETA_ESTADO[l.estado] ?? l.estado}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{formatearHora(l.iniciada_en)}</span>
                    <span>
                      {formatearDuracion(l.duracion_seg)}{" "}
                      {l.costo_usd != null && (
                        <span className="ml-1 text-zinc-400">
                          · ${l.costo_usd.toFixed(3)}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detalle */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              {!seleccionada ? (
                <p className="text-sm text-zinc-500">
                  Seleccioná una llamada para ver el detalle.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                        +{seleccionada.telefono}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {seleccionada.direccion} · iniciada{" "}
                        {formatearHora(seleccionada.iniciada_en)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => refrescarDetalle(seleccionada.id)}
                      className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
                    >
                      Refrescar
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Mini
                      label="Estado"
                      valor={
                        ETIQUETA_ESTADO[seleccionada.estado] ??
                        seleccionada.estado
                      }
                    />
                    <Mini
                      label="Duración"
                      valor={formatearDuracion(seleccionada.duracion_seg)}
                    />
                    <Mini
                      label="Costo"
                      valor={
                        seleccionada.costo_usd != null
                          ? `$${seleccionada.costo_usd.toFixed(3)}`
                          : "—"
                      }
                    />
                  </div>

                  {seleccionada.audio_url && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Grabación
                      </p>
                      <audio
                        src={seleccionada.audio_url}
                        controls
                        className="w-full"
                      />
                    </div>
                  )}

                  {seleccionada.resumen && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Resumen
                      </p>
                      <p className="rounded-xl bg-zinc-50 p-3 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200">
                        {seleccionada.resumen}
                      </p>
                    </div>
                  )}

                  {seleccionada.transcripcion && (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Transcripción
                      </p>
                      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 font-sans text-xs leading-relaxed text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
                        {seleccionada.transcripcion}
                      </pre>
                    </div>
                  )}

                  {!seleccionada.transcripcion &&
                    !seleccionada.resumen &&
                    seleccionada.estado === "completada" && (
                      <p className="text-xs text-zinc-500">
                        El webhook de Vapi todavía no entregó la transcripción.
                        Probá <em>Refrescar</em> en unos segundos.
                      </p>
                    )}

                  <p className="font-mono text-[10px] text-zinc-400">
                    vapi_call_id: {seleccionada.vapi_call_id}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-2 dark:bg-zinc-800/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {valor}
      </p>
    </div>
  );
}
