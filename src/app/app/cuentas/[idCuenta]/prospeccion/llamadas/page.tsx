"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePollingVisible } from "@/components/usePollingVisible";

interface LlamadaLog {
  id: string;
  lead_id: string;
  vapi_call_id: string | null;
  resultado: string | null;
  transcripcion: string | null;
  url_grabacion: string | null;
  duracion_segundos: number | null;
  costo_usd: number | null;
  resumen: string | null;
  creado_en: string;
  leads_extraidos?: { nombre: string; telefono: string | null; categoria: string | null };
}

const ETIQUETA_RESULTADO: Record<string, string> = {
  "customer-ended-call": "Cliente colgó",
  "assistant-ended-call": "Agente cerró",
  "customer-did-not-answer": "No contestó",
  "voicemail": "Buzón de voz",
  "no-answer": "Sin respuesta",
  completada: "Completada",
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function formatearDuracion(seg: number | null) {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function PaginaLlamadasProspeccion() {
  const params = useParams();
  const idCuenta = params.idCuenta as string;

  const [llamadas, setLlamadas] = useState<LlamadaLog[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/llamadas`);
    if (r.ok) {
      const d = await r.json() as { llamadas: LlamadaLog[] };
      setLlamadas(d.llamadas);
    }
  }, [idCuenta]);

  usePollingVisible(cargar, 20_000);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href={`/app/cuentas/${idCuenta}/prospeccion`}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              ← Volver al pipeline
            </Link>
            <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Llamadas de prospección
            </h1>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {llamadas.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              <p className="text-4xl mb-3">📞</p>
              <p>No hay llamadas registradas aún.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {llamadas.map((ll) => {
                const nombre = ll.leads_extraidos?.nombre ?? "Lead desconocido";
                const estaExpandida = expandida === ll.id;
                return (
                  <div key={ll.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">{nombre}</p>
                          {ll.resultado && (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {ETIQUETA_RESULTADO[ll.resultado] ?? ll.resultado}
                            </span>
                          )}
                          {ll.duracion_segundos && ll.duracion_segundos > 30 && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Conversación real
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex gap-3 text-xs text-zinc-400">
                          <span>{formatearDuracion(ll.duracion_segundos)}</span>
                          {ll.costo_usd && <span>${ll.costo_usd.toFixed(4)}</span>}
                          <span>{formatearFecha(ll.creado_en)}</span>
                        </div>
                        {ll.resumen && (
                          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                            {ll.resumen}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {ll.url_grabacion && (
                          <a
                            href={ll.url_grabacion}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                          >
                            🎧 Grabación
                          </a>
                        )}
                        {ll.transcripcion && (
                          <button
                            onClick={() => setExpandida(estaExpandida ? null : ll.id)}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                          >
                            {estaExpandida ? "Ocultar" : "Ver transcripción"}
                          </button>
                        )}
                      </div>
                    </div>
                    {estaExpandida && ll.transcripcion && (
                      <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                        <p className="text-xs font-semibold text-zinc-500 mb-2">TRANSCRIPCIÓN</p>
                        <pre className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300 font-mono">
                          {ll.transcripcion}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
