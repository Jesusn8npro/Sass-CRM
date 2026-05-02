"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Cuenta, EstadoSeguimiento, SeguimientoProgramado } from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaCuenta {
  cuenta: Cuenta;
}

interface SeguimientoConContacto extends SeguimientoProgramado {
  nombre_contacto: string | null;
  telefono: string | null;
}

interface RespuestaSeguimientos {
  seguimientos: SeguimientoConContacto[];
}

const COLOR_ESTADO: Record<EstadoSeguimiento, string> = {
  pendiente:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  enviado:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelado: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  fallido: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

const NOMBRE_ESTADO: Record<EstadoSeguimiento, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  cancelado: "Cancelado",
  fallido: "Fallido",
};

function formatearFechaHora(unix: number): string {
  return new Date(unix * 1000).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tiempoRelativo(unix: number): string {
  const diff = unix - Math.floor(Date.now() / 1000);
  if (Math.abs(diff) < 60) return "ahora";
  const abs = Math.abs(diff);
  const txt =
    abs < 3600
      ? `${Math.floor(abs / 60)}m`
      : abs < 86400
      ? `${Math.floor(abs / 3600)}h`
      : `${Math.floor(abs / 86400)}d`;
  return diff > 0 ? `en ${txt}` : `hace ${txt}`;
}

export default function PaginaSeguimientos() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = Number(params?.idCuenta);

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [seguimientos, setSeguimientos] = useState<SeguimientoConContacto[]>(
    [],
  );

  const cargar = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    const [resCuenta, resS] = await Promise.all([
      fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
      fetch(`/api/cuentas/${idCuenta}/seguimientos`, { cache: "no-store" }),
    ]);
    if (resCuenta.ok) {
      const d = (await resCuenta.json()) as RespuestaCuenta;
      setCuenta(d.cuenta);
    }
    if (resS.ok) {
      const d = (await resS.json()) as RespuestaSeguimientos;
      setSeguimientos(d.seguimientos);
    }
  }, [idCuenta]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  async function cancelar(id: number) {
    if (!confirm("¿Cancelar este seguimiento? No se enviará al cliente."))
      return;
    await fetch(`/api/cuentas/${idCuenta}/seguimientos/${id}`, {
      method: "DELETE",
    });
    cargar();
  }

  const pendientes = seguimientos.filter((s) => s.estado === "pendiente");
  const otros = seguimientos.filter((s) => s.estado !== "pendiente");

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
                Seguimientos programados
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <InterruptorTema />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            <strong>Anti-ban automático:</strong> Solo se envían a clientes que
            ya escribieron antes. Si el cliente responde antes del horario
            programado, el seguimiento se cancela. Máximo 80 mensajes por día
            por cuenta. Solo entre 8am y 10pm. La IA puede crear seguimientos
            cuando el cliente diga &quot;te aviso después&quot;.
          </p>
        </div>

        {pendientes.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Próximos a enviar ({pendientes.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {pendientes.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {s.nombre_contacto ?? `+${s.telefono}`}
                        {s.origen === "ia" && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                            IA
                          </span>
                        )}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {s.contenido}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Programado para {formatearFechaHora(s.programado_para)}{" "}
                        ({tiempoRelativo(s.programado_para)})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cancelar(s.id)}
                      className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-red-300"
                    >
                      Cancelar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {otros.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Histórico
            </h2>
            <ul className="flex flex-col gap-2">
              {otros.map((s) => (
                <li
                  key={s.id}
                  className="rounded-2xl border border-zinc-100 bg-white p-3 dark:border-zinc-800/60 dark:bg-zinc-900/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {s.nombre_contacto ?? `+${s.telefono}`}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            COLOR_ESTADO[s.estado]
                          }`}
                        >
                          {NOMBRE_ESTADO[s.estado]}
                        </span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {s.contenido}
                      </p>
                      {s.razon_cancelacion && (
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {s.razon_cancelacion}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-[11px] text-zinc-500">
                      {s.enviado_en
                        ? formatearFechaHora(s.enviado_en)
                        : formatearFechaHora(s.programado_para)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {seguimientos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aún no hay seguimientos programados
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Programá uno desde el chat (botón Programar) o dejá que la IA lo
              haga automáticamente cuando un cliente diga &quot;te aviso
              después&quot;.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
