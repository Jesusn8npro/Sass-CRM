"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePollingVisible } from "@/components/usePollingVisible";

interface DatosCapturados {
  nombre_contacto?: string | null;
  cargo?: string | null;
  email?: string | null;
  nivel_interes?: "alto" | "medio" | "bajo" | "no_interesado" | null;
  reunion_agendada?: boolean | null;
  fecha_reunion?: string | null;
  objecion_principal?: string | null;
  proximo_paso?: string | null;
  notas?: string | null;
}

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
  datos_capturados: DatosCapturados | null;
  creado_en: string;
  leads_extraidos?: { nombre: string; telefono: string | null; categoria: string | null };
}

const ETIQUETA_RESULTADO: Record<string, { label: string; color: string }> = {
  "customer-ended-call":     { label: "Cliente colgó",    color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  "assistant-ended-call":    { label: "Agente cerró",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  "customer-did-not-answer": { label: "No contestó",      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  "voicemail":               { label: "Buzón de voz",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  "no-answer":               { label: "Sin respuesta",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  completada:                { label: "Completada",        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

const COLOR_INTERES: Record<string, string> = {
  alto:          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  medio:         "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  bajo:          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  no_interesado: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const INTERES_LABEL: Record<string, string> = {
  alto: "Interés alto", medio: "Interés medio", bajo: "Interés bajo", no_interesado: "No interesado",
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function formatearDuracion(seg: number | null) {
  if (!seg) return null;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const VELOCIDADES = [0.75, 1, 1.25, 1.5, 2];

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [velocidad, setVelocidad] = useState(1);
  const [jugando, setJugando] = useState(false);

  function cambiarVelocidad(v: number) {
    setVelocidad(v);
    if (audioRef.current) audioRef.current.playbackRate = v;
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">🎧 Grabación</span>
        <div className="flex gap-1 ml-auto">
          {VELOCIDADES.map(v => (
            <button
              key={v}
              onClick={() => cambiarVelocidad(v)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                velocidad === v
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>
      <audio
        ref={audioRef}
        controls
        src={url}
        onPlay={() => setJugando(true)}
        onPause={() => setJugando(false)}
        onLoadedMetadata={() => {
          if (audioRef.current) audioRef.current.playbackRate = velocidad;
        }}
        className="w-full h-9"
        style={{ colorScheme: "normal" }}
      />
      {jugando && (
        <p className="mt-1 text-[10px] text-emerald-500 text-right">▶ Reproduciendo a {velocidad}x</p>
      )}
    </div>
  );
}

function TarjetaDatos({ dc }: { dc: DatosCapturados }) {
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {dc.nombre_contacto && (
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Contacto</p>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {dc.nombre_contacto}
            {dc.cargo && <span className="text-zinc-400 font-normal"> · {dc.cargo}</span>}
          </p>
        </div>
      )}
      {dc.email && (
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Email capturado</p>
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{dc.email}</p>
        </div>
      )}
      {dc.fecha_reunion && (
        <div className="rounded-lg border border-blue-100 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">Reunión</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">📅 {dc.fecha_reunion}</p>
        </div>
      )}
      {dc.proximo_paso && (
        <div className="rounded-lg border border-blue-100 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">Próximo paso</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">{dc.proximo_paso}</p>
        </div>
      )}
      {dc.objecion_principal && (
        <div className="rounded-lg border border-amber-100 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">Objeción</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">{dc.objecion_principal}</p>
        </div>
      )}
      {dc.notas && (
        <div className="rounded-lg border border-zinc-100 dark:border-zinc-700/50 bg-white dark:bg-zinc-800 px-3 py-2 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Notas</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{dc.notas}</p>
        </div>
      )}
    </div>
  );
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

  usePollingVisible(cargar, 40_000);

  const completadas = llamadas.filter(l => l.transcripcion || l.resumen || l.datos_capturados).length;
  const sinRespuesta = llamadas.filter(l =>
    l.resultado === "customer-did-not-answer" || l.resultado === "no-answer" || l.resultado === "voicemail"
  ).length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-6">
          <Link href={`/app/cuentas/${idCuenta}/prospeccion`} className="text-xs text-zinc-400 hover:text-zinc-600">
            ← Volver al pipeline
          </Link>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Llamadas de prospección</h1>
              <p className="text-sm text-zinc-500 mt-0.5">{llamadas.length} registros · {completadas} con datos · {sinRespuesta} sin respuesta</p>
            </div>
            <Link
              href={`/app/cuentas/${idCuenta}/prospeccion/asistente`}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800"
            >
              ⚙️ Configurar asistente
            </Link>
          </div>
        </div>

        {llamadas.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 py-20 text-center">
            <p className="text-4xl mb-3">📞</p>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">No hay llamadas registradas aún</p>
            <p className="text-sm text-zinc-400 mt-1">Las llamadas aparecen aquí cuando el pipeline las procesa.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {llamadas.map((ll) => {
              const nombreLead = ll.leads_extraidos?.nombre ?? "Lead desconocido";
              const estaExpandida = expandida === ll.id;
              const dc = ll.datos_capturados;
              const resultado = ll.resultado ? ETIQUETA_RESULTADO[ll.resultado] : null;
              const duracion = formatearDuracion(ll.duracion_segundos);
              const tieneContenido = !!(ll.transcripcion || ll.resumen || dc);

              return (
                <div
                  key={ll.id}
                  className={`rounded-xl border bg-white dark:bg-zinc-900 transition-shadow ${
                    tieneContenido
                      ? "border-zinc-200 dark:border-zinc-800 shadow-sm"
                      : "border-zinc-100 dark:border-zinc-800/50 opacity-70"
                  }`}
                >
                  <div className="p-4">
                    {/* Fila superior */}
                    <div className="flex flex-wrap items-start gap-2 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">{nombreLead}</p>
                          {ll.leads_extraidos?.categoria && (
                            <span className="text-xs text-zinc-400">{ll.leads_extraidos.categoria}</span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {resultado && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${resultado.color}`}>
                              {resultado.label}
                            </span>
                          )}
                          {dc?.nivel_interes && (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_INTERES[dc.nivel_interes] ?? ""}`}>
                              {INTERES_LABEL[dc.nivel_interes]}
                            </span>
                          )}
                          {dc?.reunion_agendada && (
                            <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 text-[11px] font-medium">
                              📅 Reunión agendada
                            </span>
                          )}
                          {dc?.email && (
                            <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-medium">
                              ✉ Email capturado
                            </span>
                          )}
                        </div>

                        {/* Métricas */}
                        <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-zinc-400">
                          {duracion && <span>⏱ {duracion}</span>}
                          {ll.costo_usd != null && ll.costo_usd > 0 && (
                            <span>💰 ${ll.costo_usd.toFixed(4)}</span>
                          )}
                          <span>{formatearFecha(ll.creado_en)}</span>
                        </div>
                      </div>

                      {/* Botón transcripción */}
                      {ll.transcripcion && (
                        <button
                          onClick={() => setExpandida(estaExpandida ? null : ll.id)}
                          className="shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          {estaExpandida ? "▲ Cerrar" : "▼ Transcripción"}
                        </button>
                      )}
                    </div>

                    {/* Resumen */}
                    {ll.resumen && !dc && (
                      <p className="mt-2.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-50 dark:border-zinc-800 pt-2.5">
                        {ll.resumen}
                      </p>
                    )}

                    {/* Datos capturados */}
                    {dc && <TarjetaDatos dc={dc} />}

                    {/* Audio player */}
                    {ll.url_grabacion && <AudioPlayer url={ll.url_grabacion} />}

                    {/* Transcripción expandida */}
                    {estaExpandida && ll.transcripcion && (
                      <div className="mt-3 rounded-xl border border-zinc-100 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Transcripción</p>
                        <div className="space-y-2">
                          {ll.transcripcion.split("\n").filter(Boolean).map((linea, i) => {
                            const esAI = linea.startsWith("AI:");
                            const esUser = linea.startsWith("User:");
                            return (
                              <div key={i} className={`flex gap-2 ${esAI ? "" : "flex-row-reverse"}`}>
                                <span className={`shrink-0 rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold ${
                                  esAI ? "bg-emerald-500 text-white" : esUser ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200" : "bg-transparent"
                                }`}>
                                  {esAI ? "AI" : esUser ? "U" : ""}
                                </span>
                                <p className={`rounded-xl px-3 py-1.5 text-xs leading-relaxed max-w-[85%] ${
                                  esAI
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                                    : esUser
                                    ? "bg-white dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-600"
                                    : "text-zinc-500 font-mono text-[11px]"
                                }`}>
                                  {linea.replace(/^(AI:|User:)\s*/, "")}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
