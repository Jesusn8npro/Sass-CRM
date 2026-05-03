"use client";

import type { MetricasCuenta } from "@/lib/baseDatos";
import { Kpi } from "./_componentes";

export function SeccionCRMyCitas({ metricas }: { metricas: MetricasCuenta }) {
  return (
    <>
            {/* CRM — Lead tracking */}
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                CRM · Performance del agente
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi
                  titulo="Lead score promedio"
                  valor={`${metricas.lead_score_promedio}%`}
                  detalle="Salud general de los leads"
                  acento={
                    metricas.lead_score_promedio >= 60
                      ? "esmeralda"
                      : metricas.lead_score_promedio >= 30
                      ? undefined
                      : "rojo"
                  }
                />
                <Kpi
                  titulo="Casi a confirmar"
                  valor={metricas.casi_a_confirmar}
                  detalle="Negociación o score ≥ 75"
                  acento={
                    metricas.casi_a_confirmar > 0 ? "esmeralda" : undefined
                  }
                />
                <Kpi
                  titulo="Tasa de aceptación"
                  valor={`${metricas.tasa_aceptacion}%`}
                  detalle="Cerrados sobre decididos"
                  acento={
                    metricas.tasa_aceptacion >= 50
                      ? "esmeralda"
                      : metricas.tasa_aceptacion > 0
                      ? undefined
                      : "rojo"
                  }
                />
                <Kpi
                  titulo="Cerrados"
                  valor={
                    metricas.por_estado_lead.find((e) => e.estado === "cerrado")
                      ?.count ?? 0
                  }
                  detalle="Ventas confirmadas"
                  acento="esmeralda"
                />
              </div>

              {/* Embudo por estado del lead */}
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-sm font-semibold">Embudo de leads</h3>
                {metricas.por_estado_lead.every((e) => e.count === 0) ? (
                  <p className="text-xs text-zinc-500">
                    Aún no hay leads. Cuando llegue el primer cliente vas a ver
                    aquí su progreso.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {metricas.por_estado_lead.map((e) => {
                      const max = Math.max(
                        ...metricas.por_estado_lead.map((x) => x.count),
                        1,
                      );
                      const pct = (e.count / max) * 100;
                      const colorBar: Record<string, string> = {
                        nuevo: "bg-zinc-400",
                        contactado: "bg-blue-500",
                        calificado: "bg-violet-500",
                        interesado: "bg-amber-500",
                        negociacion: "bg-orange-500",
                        cerrado: "bg-emerald-500",
                        perdido: "bg-red-500",
                      };
                      return (
                        <li
                          key={e.estado}
                          className="flex items-center gap-3 text-xs"
                        >
                          <span className="w-24 shrink-0 capitalize text-zinc-600 dark:text-zinc-400">
                            {e.estado}
                          </span>
                          <div className="flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className={`h-2 rounded-full ${colorBar[e.estado] ?? "bg-zinc-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right font-mono font-bold tabular-nums">
                            {e.count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* Citas */}
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                Agenda · Citas
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi
                  titulo="Citas hoy"
                  valor={metricas.citas_hoy}
                  detalle="Eventos del día"
                  acento={metricas.citas_hoy > 0 ? "ambar" : undefined}
                />
                <Kpi
                  titulo="Próximos 7 días"
                  valor={metricas.citas_proximas_7d}
                  detalle="Pendientes y confirmadas"
                />
                <Kpi
                  titulo="Realizadas"
                  valor={metricas.citas_realizadas}
                  detalle={`${metricas.citas_canceladas} canceladas · ${metricas.citas_no_asistio} no asistió`}
                  acento="esmeralda"
                />
                <Kpi
                  titulo="Tasa asistencia"
                  valor={`${metricas.tasa_asistencia_citas}%`}
                  detalle="Realizadas / cerradas"
                  acento={
                    metricas.tasa_asistencia_citas >= 70
                      ? "esmeralda"
                      : metricas.tasa_asistencia_citas > 0
                      ? "ambar"
                      : undefined
                  }
                />
              </div>
            </section>
    </>
  );
}
