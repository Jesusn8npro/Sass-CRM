"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface MetricasMes {
  total_conversaciones: number;
  nuevas_este_mes: number;
  mensajes_enviados: number;
  mensajes_recibidos: number;
  leads_por_estado: Record<string, number>;
  tasa_respuesta: number;
}

interface UsoProveedor {
  proveedor: string;
  costo_usd: number;
  eventos: number;
}

const LABEL_PROVEEDOR: Record<string, string> = {
  openai: "OpenAI (IA)",
  vapi: "Vapi (Llamadas)",
  elevenlabs: "ElevenLabs (Voz)",
  apify: "Apify (Leads)",
  whisper: "Whisper (Transcripción)",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

const LABEL_ESTADO: Record<string, string> = {
  nuevo: "Nuevos", contactado: "Contactados", calificado: "Calificados",
  interesado: "Interesados", negociacion: "En Negociación",
  cerrado: "Cerrados", perdido: "Perdidos",
};

function fmt(n: number, dec = 2) {
  return n.toLocaleString("es", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function PaginaReportes() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [metricas, setMetricas] = useState<MetricasMes | null>(null);
  const [uso, setUso] = useState<UsoProveedor[]>([]);
  const [etiqueta, setEtiqueta] = useState("");
  const [cargando, setCargando] = useState(true);
  const now = new Date();
  const mesNombre = now.toLocaleDateString("es", { month: "long", year: "numeric" });

  const cargar = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const [m, u] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}/metricas`).then((r) => r.json() as Promise<MetricasMes>),
        fetch(`/api/cuentas/${idCuenta}/creditos/uso-mes`).then((r) => r.json() as Promise<{ uso: UsoProveedor[]; etiqueta: string }>),
      ]);
      setMetricas(m);
      setUso(u.uso ?? []);
      setEtiqueta(u.etiqueta ?? "");
    } catch { /* ignore */ } finally {
      setCargando(false);
    }
  }, [idCuenta]);

  useEffect(() => { void cargar(); }, [cargar]);

  const totalUsdMes = uso.reduce((s, u) => s + u.costo_usd, 0);
  const estados = Object.entries(metricas?.leads_por_estado ?? {});

  return (
    <>
      {/* Barra de herramientas — se oculta al imprimir */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="flex items-center gap-3">
          <Link href={`/app/cuentas/${idCuenta}/dashboard`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Volver
          </Link>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Reporte mensual — {mesNombre}</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M6 9V2h12v7" /><rect x="6" y="14" width="12" height="8" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          </svg>
          Exportar PDF
        </button>
      </div>

      {/* Contenido del reporte */}
      <div className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-4">
        {/* Encabezado del reporte */}
        <div className="mb-8 flex items-start justify-between border-b border-zinc-200 pb-6 dark:border-zinc-700">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Reporte Mensual</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{etiqueta || "CRM WhatsApp"}</h1>
            <p className="mt-0.5 text-sm text-zinc-500 capitalize">{mesNombre}</p>
          </div>
          <div className="text-right text-xs text-zinc-400">
            <p>Generado el {now.toLocaleDateString("es", { dateStyle: "long" })}</p>
          </div>
        </div>

        {cargando ? (
          <p className="text-sm text-zinc-400">Cargando datos…</p>
        ) : (
          <>
            {/* KPIs principales */}
            <section className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Actividad del mes</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Conversaciones activas", valor: metricas?.total_conversaciones ?? 0 },
                  { label: "Nuevas este mes", valor: metricas?.nuevas_este_mes ?? 0 },
                  { label: "Mensajes enviados", valor: metricas?.mensajes_enviados ?? 0 },
                  { label: "Mensajes recibidos", valor: metricas?.mensajes_recibidos ?? 0 },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                    <p className="text-xs text-zinc-500">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{k.valor.toLocaleString("es")}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Pipeline de leads */}
            {estados.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Pipeline de leads</h2>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Estado</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Leads</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">% del total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estados.map(([estado, cant]) => {
                        const total = estados.reduce((s, [, c]) => s + c, 0);
                        return (
                          <tr key={estado} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50">
                            <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{LABEL_ESTADO[estado] ?? estado}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-zinc-900 dark:text-zinc-50">{cant}</td>
                            <td className="px-4 py-2.5 text-right text-zinc-500">{total > 0 ? fmt((cant / total) * 100, 1) : "0.0"}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Gasto por plataforma */}
            {uso.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Gasto en plataformas IA</h2>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Plataforma</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Llamadas / Eventos</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uso.map((u) => (
                        <tr key={u.proveedor} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50">
                          <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{LABEL_PROVEEDOR[u.proveedor] ?? u.proveedor}</td>
                          <td className="px-4 py-2.5 text-right text-zinc-500">{u.eventos.toLocaleString("es")}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-zinc-900 dark:text-zinc-50">${fmt(u.costo_usd)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/30">
                        <td colSpan={2} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-300">${fmt(totalUsdMes)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="mt-10 border-t border-zinc-100 pt-4 text-center text-[10px] uppercase tracking-[0.18em] text-zinc-400 print:text-zinc-500 dark:border-zinc-800">
              Generado por SaaS CRM · {now.toLocaleDateString("es", { dateStyle: "full" })}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
