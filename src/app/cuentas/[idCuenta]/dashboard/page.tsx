"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ContactoEmail,
  Cuenta,
  MetricasCuenta,
} from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaCuenta {
  cuenta: Cuenta;
}

interface RespuestaContactos {
  contactos: Array<
    ContactoEmail & {
      nombre_contacto: string | null;
      telefono: string | null;
    }
  >;
}

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

function formatearFecha(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatearDia(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" });
}

export default function PaginaDashboard() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = Number(params?.idCuenta);

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [metricas, setMetricas] = useState<MetricasCuenta | null>(null);
  const [contactos, setContactos] = useState<
    RespuestaContactos["contactos"]
  >([]);

  const cargarTodo = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    try {
      const [resCuenta, resMetricas, resContactos] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/metricas`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/contactos-email`, {
          cache: "no-store",
        }),
      ]);
      if (resCuenta.ok) {
        const d = (await resCuenta.json()) as RespuestaCuenta;
        setCuenta(d.cuenta);
      }
      if (resMetricas.ok) {
        const d = (await resMetricas.json()) as MetricasCuenta;
        setMetricas(d);
      }
      if (resContactos.ok) {
        const d = (await resContactos.json()) as RespuestaContactos;
        setContactos(d.contactos);
      }
    } catch (err) {
      console.error("[dashboard] error cargando:", err);
    }
  }, [idCuenta]);

  useEffect(() => {
    cargarTodo();
    const t = setInterval(cargarTodo, 10000);
    return () => clearInterval(t);
  }, [cargarTodo]);

  const maxBarra = metricas
    ? Math.max(1, ...metricas.mensajes_por_dia.map((d) => d.count))
    : 1;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
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
                Dashboard
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/cuentas/${idCuenta}/pipeline`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Pipeline
            </Link>
            <Link
              href={`/cuentas/${idCuenta}/configuracion`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Ajustes
            </Link>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {!metricas ? (
          <p className="text-sm text-zinc-500">Cargando métricas...</p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* KPIs principales */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi
                titulo="Conversaciones"
                valor={metricas.conversaciones_total}
                detalle={`${metricas.conversaciones_modo_ia} en IA · ${metricas.conversaciones_modo_humano} en humano`}
              />
              <Kpi
                titulo="Necesitan atención"
                valor={metricas.conversaciones_necesitan_humano}
                detalle="Marcadas con badge rojo"
                acento={
                  metricas.conversaciones_necesitan_humano > 0
                    ? "rojo"
                    : undefined
                }
              />
              <Kpi
                titulo="Mensajes hoy"
                valor={metricas.mensajes_hoy}
                detalle={`${metricas.mensajes_ultimos_7d} en últimos 7 días`}
              />
              <Kpi
                titulo="Emails capturados"
                valor={metricas.emails_capturados}
                detalle="Detectados en mensajes entrantes"
                acento={
                  metricas.emails_capturados > 0 ? "esmeralda" : undefined
                }
              />
            </section>

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

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Pipeline overview */}
              <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Pipeline
                  </h2>
                  <Link
                    href={`/cuentas/${idCuenta}/pipeline`}
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
                      <li
                        key={e.etapa_id ?? "sin"}
                        className="flex items-center gap-3"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            CLASE_COLOR_BARRA[e.color] ??
                            CLASE_COLOR_BARRA.zinc
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
                      <li
                        key={e.etiqueta_id}
                        className="flex items-center gap-3"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            CLASE_COLOR_BARRA[e.color] ??
                            CLASE_COLOR_BARRA.zinc
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

            {/* Contactos email */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Emails capturados ({contactos.length})
                </h2>
                {contactos.length > 0 && (
                  <a
                    href={`/api/cuentas/${idCuenta}/contactos-email?formato=csv`}
                    className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400"
                  >
                    Exportar CSV
                  </a>
                )}
              </div>
              {contactos.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Aún no se capturó ningún email. Cuando un cliente escriba
                  su email en una conversación, aparece acá.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                        <th className="px-2 py-2 font-semibold">Email</th>
                        <th className="px-2 py-2 font-semibold">Contacto</th>
                        <th className="px-2 py-2 font-semibold">Teléfono</th>
                        <th className="px-2 py-2 font-semibold">
                          Capturado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactos.slice(0, 50).map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-zinc-50 dark:border-zinc-800/60"
                        >
                          <td className="px-2 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                            {c.email}
                          </td>
                          <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                            {c.nombre_contacto ?? "—"}
                          </td>
                          <td className="px-2 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {c.telefono ? `+${c.telefono}` : "—"}
                          </td>
                          <td className="px-2 py-2 text-xs text-zinc-500">
                            {formatearFecha(c.capturado_en)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {contactos.length > 50 && (
                    <p className="mt-2 text-center text-[11px] text-zinc-500">
                      Mostrando 50 de {contactos.length}. Exportá CSV para
                      ver todos.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function Kpi({
  titulo,
  valor,
  detalle,
  acento,
}: {
  titulo: string;
  valor: number;
  detalle?: string;
  acento?: "rojo" | "esmeralda";
}) {
  const colorValor =
    acento === "rojo"
      ? "text-red-600 dark:text-red-400"
      : acento === "esmeralda"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {titulo}
      </p>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${colorValor}`}>
        {valor}
      </p>
      {detalle && (
        <p className="mt-1 text-[11px] text-zinc-500">{detalle}</p>
      )}
    </div>
  );
}
