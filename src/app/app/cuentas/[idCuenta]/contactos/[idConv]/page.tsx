"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  Conversacion,
  EtapaPipeline,
  InteresConProducto,
  LlamadaVapi,
  Mensaje,
} from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaCliente360 {
  conversacion: Conversacion;
  etapa: EtapaPipeline | null;
  productos_interes: InteresConProducto[];
  llamadas: LlamadaVapi[];
  ultimos_mensajes: Mensaje[];
  estadisticas: {
    total_mensajes: number;
    recibidos: number;
    respuestas_ia: number;
    respuestas_humano: number;
    cantidad_llamadas: number;
    productos_distintos: number;
  };
}

const COLOR_DOT: Record<string, string> = {
  zinc: "bg-zinc-400",
  rojo: "bg-red-500",
  ambar: "bg-amber-500",
  amarillo: "bg-yellow-500",
  esmeralda: "bg-emerald-500",
  azul: "bg-blue-500",
  violeta: "bg-violet-500",
  rosa: "bg-pink-500",
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PaginaCliente360() {
  const params = useParams<{ idCuenta: string; idConv: string }>();
  const idCuenta = params?.idCuenta ?? "";
  const idConv = params?.idConv ?? "";

  const [data, setData] = useState<RespuestaCliente360 | null>(null);

  const cargar = useCallback(async () => {
    if (!idCuenta || !idConv) return;
    const res = await fetch(
      `/api/cuentas/${idCuenta}/conversaciones/${idConv}/cliente-360`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const d = (await res.json()) as RespuestaCliente360;
      setData(d);
    }
  }, [idCuenta, idConv]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 8000);
    return () => clearInterval(t);
  }, [cargar]);

  async function llamar() {
    if (!data) return;
    if (!confirm(`¿Llamar a +${data.conversacion.telefono}?`)) return;
    const res = await fetch(`/api/cuentas/${idCuenta}/llamadas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telefono: data.conversacion.telefono,
        nombre: data.conversacion.nombre,
      }),
    });
    if (res.ok) {
      alert("Llamada disparada. Verificá en /llamadas en unos segundos.");
      cargar();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      alert("Error: " + (d.error ?? `HTTP ${res.status}`));
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <p className="p-8 text-sm text-zinc-500">Cargando...</p>
      </main>
    );
  }

  const c = data.conversacion;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Cliente 360
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {c.nombre ?? `+${c.telefono}`}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/app?cuenta=${idCuenta}&conv=${idConv}`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Abrir chat
            </Link>
            <button
              type="button"
              onClick={llamar}
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
            >
              📞 Llamar
            </button>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        {/* Datos básicos */}
        <section className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Contacto
            </h2>
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {c.nombre ?? "(sin nombre)"}
            </p>
            <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
              +{c.telefono}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  c.modo === "IA"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                }`}
              >
                Modo: {c.modo}
              </span>
              {data.etapa && (
                <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      COLOR_DOT[data.etapa.color] ?? COLOR_DOT.zinc
                    }`}
                  />
                  {data.etapa.nombre}
                </span>
              )}
              {c.necesita_humano && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
                  Necesita atención
                </span>
              )}
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              Cliente desde {formatearFecha(c.creada_en)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Actividad
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Mensajes</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {data.estadisticas.total_mensajes}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Llamadas</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {data.estadisticas.cantidad_llamadas}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">
                  Respondió IA
                </p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {data.estadisticas.respuestas_ia}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-500">
                  Respondió humano
                </p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                  {data.estadisticas.respuestas_humano}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Productos de interés */}
        <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Productos de interés ({data.productos_interes.length})
          </h2>
          {data.productos_interes.length === 0 ? (
            <p className="text-xs text-zinc-500">
              El cliente todavía no preguntó por productos específicos.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.productos_interes.map((p) => (
                <li
                  key={p.producto_id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-800/30"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-700">
                    {p.imagen_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/productos/${p.imagen_path}`}
                        alt={p.nombre}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {p.nombre}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {p.precio != null
                        ? `${p.precio.toLocaleString("es-CO")} ${p.moneda}`
                        : "consultar"}{" "}
                      ·{" "}
                      {p.stock != null
                        ? p.stock > 0
                          ? `stock ${p.stock}`
                          : "sin stock"
                        : ""}{" "}
                      · {p.veces}× preguntado
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {tiempoRelativo(p.ultimo_interes_en)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Llamadas */}
        <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Llamadas ({data.llamadas.length})
            </h2>
            <Link
              href={`/app/cuentas/${idCuenta}/llamadas`}
              className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
            >
              Ver todas →
            </Link>
          </div>
          {data.llamadas.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Sin llamadas todavía. Usá el botón Llamar arriba.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.llamadas.slice(0, 5).map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-zinc-100 p-2 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      {l.estado}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {formatearFecha(l.iniciada_en)}
                    </span>
                  </div>
                  {l.resumen && (
                    <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                      {l.resumen.slice(0, 200)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Últimos mensajes */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Últimos mensajes
          </h2>
          {data.ultimos_mensajes.length === 0 ? (
            <p className="text-xs text-zinc-500">Sin mensajes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.ultimos_mensajes.slice(-15).map((m) => {
                const quien =
                  m.rol === "usuario"
                    ? "Cliente"
                    : m.rol === "asistente"
                    ? "IA"
                    : m.rol === "humano"
                    ? "Vos"
                    : "Sistema";
                const colorBg =
                  m.rol === "usuario"
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "bg-emerald-50 dark:bg-emerald-500/10";
                return (
                  <li
                    key={m.id}
                    className={`rounded-xl px-3 py-2 ${colorBg}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {quien}
                        {m.tipo !== "texto" && ` · ${m.tipo}`}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {tiempoRelativo(m.creado_en)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">
                      {m.contenido.slice(0, 300)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
