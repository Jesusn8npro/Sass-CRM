"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  ContactoEmail,
  ContactoTelefono,
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

interface RespuestaTelefonos {
  contactos: Array<
    ContactoTelefono & {
      nombre_contacto: string | null;
      telefono_conv: string | null;
    }
  >;
}

import { Kpi } from "./_componentes";
import {
  SeccionContactosCapturados,
  SeccionVolumenYTops,
} from "./_secciones";
import { SeccionCRMyCitas } from "./_secciones-crm";

export default function PaginaDashboard() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [metricas, setMetricas] = useState<MetricasCuenta | null>(null);
  const [contactos, setContactos] = useState<
    RespuestaContactos["contactos"]
  >([]);
  const [telefonos, setTelefonos] = useState<
    RespuestaTelefonos["contactos"]
  >([]);
  const [llamandoId, setLlamandoId] = useState<string | null>(null);

  const cargarTodo = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const [resCuenta, resMetricas, resContactos, resTels] = await Promise.all(
        [
          fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
          fetch(`/api/cuentas/${idCuenta}/metricas`, { cache: "no-store" }),
          fetch(`/api/cuentas/${idCuenta}/contactos-email`, {
            cache: "no-store",
          }),
          fetch(`/api/cuentas/${idCuenta}/contactos-telefono`, {
            cache: "no-store",
          }),
        ],
      );
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
      if (resTels.ok) {
        const d = (await resTels.json()) as RespuestaTelefonos;
        setTelefonos(d.contactos);
      }
    } catch (err) {
      console.error("[dashboard] error cargando:", err);
    }
  }, [idCuenta]);

  async function llamarTelefono(idContacto: string, tel: string) {
    if (llamandoId !== null) return;
    if (!confirm(`¿Llamar a +${tel}?`)) return;
    setLlamandoId(idContacto);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/llamadas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: tel }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { llamada: { vapi_call_id: string } }
        | { error: string };
      if (res.ok && "llamada" in data) {
        alert(`Llamada disparada (${data.llamada.vapi_call_id.slice(0, 10)}…)`);
      } else {
        alert(
          "Error: " +
            (("error" in data && data.error) || `HTTP ${res.status}`),
        );
      }
    } catch (err) {
      alert(
        "Error de red: " +
          (err instanceof Error ? err.message : "desconocido"),
      );
    } finally {
      setLlamandoId(null);
    }
  }

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
                Dashboard
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/cuentas/${idCuenta}/pipeline`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Pipeline
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
              <a
                href="#atencion"
                className={
                  metricas.conversaciones_necesitan_humano > 0
                    ? "block transition-transform hover:-translate-y-0.5"
                    : "block"
                }
              >
                <Kpi
                  titulo="Necesitan atención"
                  valor={metricas.conversaciones_necesitan_humano}
                  detalle={
                    metricas.conversaciones_necesitan_humano > 0
                      ? "Tocá para ver la lista ↓"
                      : "Sin pendientes"
                  }
                  acento={
                    metricas.conversaciones_necesitan_humano > 0
                      ? "rojo"
                      : undefined
                  }
                />
              </a>
              <Kpi
                titulo="Mensajes hoy"
                valor={metricas.mensajes_hoy}
                detalle={`${metricas.mensajes_ultimos_7d} en últimos 7 días`}
              />
              <Kpi
                titulo="Productos activos"
                valor={metricas.productos_total}
                detalle={
                  metricas.productos_sin_stock > 0
                    ? `${metricas.productos_sin_stock} sin stock`
                    : "Catálogo configurado"
                }
                acento={
                  metricas.productos_sin_stock > 0 ? "rojo" : undefined
                }
              />
            </section>

            <SeccionCRMyCitas metricas={metricas} />

            {/* Conversaciones que necesitan atención — cards clickeables */}
            {metricas.conversaciones_atencion.length > 0 && (
              <section
                id="atencion"
                className="rounded-2xl border border-red-200 bg-red-50/40 p-4 dark:border-red-500/30 dark:bg-red-950/20"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
                      ⚠ Conversaciones que necesitan atención
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Tocá una para abrirla directamente
                    </p>
                  </div>
                  <span className="rounded-full bg-red-500 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                    {metricas.conversaciones_atencion.length}
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {metricas.conversaciones_atencion.map((c) => (
                    <li key={c.conversacion_id}>
                      <Link
                        href={`/app/cuentas/${idCuenta}/conversaciones?conv=${c.conversacion_id}`}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-red-200/60 bg-white px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md dark:border-red-500/20 dark:bg-zinc-900 dark:hover:border-red-500/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600 text-sm font-bold text-white">
                            {(c.nombre[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {c.nombre}
                            </p>
                            <p className="truncate font-mono text-[10px] text-zinc-500">
                              +{c.telefono} ·{" "}
                              {c.ultimo_mensaje_en
                                ? new Date(c.ultimo_mensaje_en).toLocaleString(
                                    "es-AR",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {c.estado_lead}
                          </span>
                          <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            {c.lead_score}%
                          </span>
                          <span className="text-zinc-400 transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* KPIs de captura + dinero */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Kpi
                titulo="Emails capturados"
                valor={metricas.emails_capturados}
                detalle="Detectados en mensajes"
                acento={
                  metricas.emails_capturados > 0 ? "esmeralda" : undefined
                }
              />
              <Kpi
                titulo="Teléfonos capturados"
                valor={metricas.telefonos_capturados}
                detalle="Mencionados en chats"
              />
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Inversión total
                </p>
                {metricas.inversiones_por_moneda.length === 0 ? (
                  <>
                    <p className="mt-1 text-3xl font-bold text-zinc-400">
                      —
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Sin gastos registrados
                    </p>
                  </>
                ) : (
                  <>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {metricas.inversiones_por_moneda.map((m) => (
                        <li
                          key={m.moneda}
                          className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
                        >
                          {m.total.toLocaleString("es-CO", {
                            maximumFractionDigits: 0,
                          })}{" "}
                          <span className="text-xs font-normal text-zinc-500">
                            {m.moneda}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/app/cuentas/${idCuenta}/inversiones`}
                      className="mt-1 inline-block text-[11px] text-emerald-700 underline dark:text-emerald-400"
                    >
                      Ver detalle →
                    </Link>
                  </>
                )}
              </div>
            </section>

            <SeccionVolumenYTops
              metricas={metricas}
              idCuenta={idCuenta}
              maxBarra={maxBarra}
            />

            <SeccionContactosCapturados
              contactos={contactos}
              telefonos={telefonos}
              idCuenta={idCuenta}
              llamarTelefono={llamarTelefono}
              llamandoId={llamandoId}
            />
          </div>
        )}
      </div>
    </main>
  );
}
