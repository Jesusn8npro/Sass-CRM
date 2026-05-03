"use client";

import Link from "next/link";
import type { Conversacion, Cuenta, ModoConversacion } from "@/lib/baseDatos";
import { BotonLlamar } from "./BotonLlamar";
import { InterruptorModo } from "./InterruptorModo";

const COLOR_ESTADO: Record<string, string> = {
  nuevo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  contactado: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  calificado: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  interesado: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  negociacion: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  cerrado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export function ChatHeader({
  idCuenta,
  cuenta,
  conversacion,
  inicial,
  enLinea,
  nombreReal,
  paso,
  estadoLead,
  score,
  abrirDetalle,
  actualizarModo,
  onVolver,
}: {
  idCuenta: string;
  cuenta: Cuenta;
  conversacion: Conversacion;
  inicial: string;
  enLinea: boolean;
  nombreReal: string;
  paso: string;
  estadoLead: string;
  score: number;
  abrirDetalle: () => void;
  actualizarModo: (m: ModoConversacion) => void;
  onVolver?: () => void;
}) {
  return (
    <header className="flex w-full shrink-0 items-center justify-between gap-1.5 overflow-hidden border-b border-zinc-200 bg-white/70 px-2 py-2.5 backdrop-blur-md md:gap-3 md:px-5 md:py-3.5 dark:border-zinc-800 dark:bg-zinc-950/60">
      {onVolver && (
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a la lista de conversaciones"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <Link
        href={`/app/cuentas/${idCuenta}/contactos/${conversacion.id}`}
        className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-1 -mx-1 -my-1 transition-colors hover:bg-zinc-100 md:gap-3 dark:hover:bg-zinc-800/50"
        title="Ver perfil completo del cliente"
      >
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-semibold text-white shadow-sm md:h-11 md:w-11 md:text-base">
            {inicial}
          </div>
          {enLinea && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold tracking-tight group-hover:text-emerald-700 md:text-base dark:group-hover:text-emerald-300">
            {nombreReal}
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] md:gap-1.5 md:text-[11px]">
            <span className="hidden text-zinc-500 sm:inline">Paso:</span>
            <span className="truncate font-mono font-semibold text-zinc-700 dark:text-zinc-300">
              {paso}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider md:px-2 ${COLOR_ESTADO[estadoLead] ?? COLOR_ESTADO.nuevo}`}
            >
              {estadoLead}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        <div
          className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-500/20 sm:inline-flex dark:bg-emerald-950/30 dark:text-emerald-300"
          title="Lead score"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span className="font-mono text-xs font-bold">{score}</span>
        </div>

        <button
          type="button"
          onClick={abrirDetalle}
          title="Ver datos del cliente"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700 sm:flex dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-emerald-950/30"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        <BotonLlamar
          cuenta={cuenta}
          telefono={conversacion.telefono}
          nombre={conversacion.nombre}
        />

        <InterruptorModo
          idCuenta={idCuenta}
          idConversacion={conversacion.id}
          modo={conversacion.modo}
          onCambio={actualizarModo}
        />
      </div>
    </header>
  );
}
