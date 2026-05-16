"use client";

import Link from "next/link";
import type { MetricasCuenta } from "@/lib/baseDatos";
import { Kpi, formatearDia } from "./_componentes";

const CLASE_COLOR_BARRA: Record<string, string> = {
  zinc: "bg-zinc-400",
  rojo: "bg-red-500",
  ambar: "bg-amber-500",
  amarillo: "bg-yellow-500",
  esmeralda: "bg-emerald-500",
  azul: "bg-blue-500",
  violeta: "bg-violet-500",
  rosa: "bg-pink-500",
};

export function SeccionVolumenYTops({
  metricas,
  idCuenta,
  maxBarra,
}: {
  metricas: MetricasCuenta;
  idCuenta: string;
  maxBarra: number;
}) {
  return (
    <>
      {/* Volumen por día */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Mensajes por día
          </h2>
          <p className="text-[11px] text-zinc-500">últimos 7 días</p>
        </div>
        {metricas.mensajes_por_dia.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Sin actividad en los últimos 7 días.
          </p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {metricas.mensajes_por_dia.map((d) => {
              const altura = (d.count / maxBarra) * 100;
              return (
                <div
                  key={d.dia}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-emerald-500 transition-all"
                      style={{ height: `${altura}%` }}
                      title={`${d.count} mensajes`}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {formatearDia(d.dia)}
                  </p>
                  <p className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                    {d.count}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Productos top: los más preguntados por clientes */}
      {metricas.productos_top.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Productos más preguntados
            </h2>
            <Link
              href={`/app/cuentas/${idCuenta}/productos`}
              className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
            >
              Ver todos →
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {metricas.productos_top.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/cuentas/${idCuenta}/productos/${p.id}/interesados`}
                    className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {p.nombre}
                  </Link>
                  <p className="text-[11px] text-zinc-500">
                    {p.precio != null
                      ? `${p.precio.toLocaleString("es-CO")} ${p.moneda}`
                      : "consultar"}
                    {p.stock != null &&
                      (p.stock > 0
                        ? ` · stock ${p.stock}`
                        : " · SIN STOCK")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {p.conversaciones_interesadas}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    interesado{p.conversaciones_interesadas === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline overview */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Pipeline
            </h2>
            <Link
              href={`/app/cuentas/${idCuenta}/pipeline`}
              className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
            >
              Ver Kanban →
            </Link>
          </div>
          {metricas.por_etapa.length === 0 ? (
            <p className="text-xs text-zinc-500">Sin etapas creadas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {metricas.por_etapa.map((e) => (
                <li key={e.etapa_id ?? "sin"} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      CLASE_COLOR_BARRA[e.color] ?? CLASE_COLOR_BARRA.zinc
                    }`}
                  />
                  <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {e.nombre}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {e.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Etiquetas */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Etiquetas
            </h2>
          </div>
          {metricas.por_etiqueta.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Sin etiquetas. Creá algunas en Ajustes.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {metricas.por_etiqueta.map((e) => (
                <li key={e.etiqueta_id} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      CLASE_COLOR_BARRA[e.color] ?? CLASE_COLOR_BARRA.zinc
                    }`}
                  />
                  <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {e.nombre}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {e.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Actividad de mensajes */}
      <section className="grid gap-3 md:grid-cols-3">
        <Kpi
          titulo="Mensajes recibidos"
          valor={metricas.mensajes_recibidos}
          detalle="Entrantes del cliente"
        />
        <Kpi
          titulo="Respondidos por IA"
          valor={metricas.mensajes_enviados_bot}
          detalle="Auto-generados"
        />
        <Kpi
          titulo="Respondidos por humano"
          valor={metricas.mensajes_enviados_humano}
          detalle="Desde el panel"
        />
      </section>
    </>
  );
}


