"use client";

import { useState } from "react";
import Link from "next/link";
import type { Cuenta } from "@/lib/baseDatos";

interface Props {
  cuenta: Cuenta;
  onDesconectar: () => void;
  /** Solo en mobile: callback para abrir el drawer de cuentas */
  onAbrirCuentas?: () => void;
}

export function EncabezadoCuenta({
  cuenta,
  onDesconectar,
  onAbrirCuentas,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function desconectar() {
    if (enviando) return;
    setEnviando(true);
    try {
      await fetch(`/api/cuentas/${cuenta.id}/conexion/desconectar`, {
        method: "POST",
      });
      onDesconectar();
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  }

  const conectado = cuenta.estado === "conectado";

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-3 py-3 backdrop-blur-md md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-2.5 min-w-0 md:gap-3">
        {/* Hamburger — solo móvil */}
        {onAbrirCuentas && (
          <button
            type="button"
            onClick={onAbrirCuentas}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 md:hidden dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            aria-label="Cambiar de cuenta"
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
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            conectado
              ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
              : "bg-zinc-200 ring-1 ring-zinc-300 dark:bg-zinc-800 dark:ring-zinc-700"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              conectado
                ? "bg-emerald-500 animate-pulso-suave"
                : "bg-zinc-400 dark:bg-zinc-600"
            }`}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {cuenta.etiqueta}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
            {cuenta.telefono ? `+${cuenta.telefono}` : "sin conectar"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/cuentas/${cuenta.id}/dashboard`}
          title="Dashboard"
          className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span className="hidden md:inline">Dashboard</span>
        </Link>

        <Link
          href={`/cuentas/${cuenta.id}/pipeline`}
          title="Pipeline"
          className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <rect x="3" y="4" width="5" height="16" rx="1" />
            <rect x="10" y="4" width="5" height="10" rx="1" />
            <rect x="17" y="4" width="4" height="6" rx="1" />
          </svg>
          <span className="hidden md:inline">Pipeline</span>
        </Link>

        <Link
          href={`/cuentas/${cuenta.id}/llamadas`}
          title="Llamadas"
          className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="hidden md:inline">Llamadas</span>
        </Link>

        <Link
          href={`/cuentas/${cuenta.id}/configuracion`}
          title="Ajustes"
          className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span className="hidden md:inline">Ajustes</span>
        </Link>

        {confirmando ? (
          <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-1">
            <span className="px-2 text-[11px] text-red-700 dark:text-red-300">
              ¿Desconectar?
            </span>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-full px-2 py-1 text-[11px] text-zinc-500"
            >
              No
            </button>
            <button
              type="button"
              onClick={desconectar}
              disabled={enviando}
              className="rounded-full bg-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-700 dark:text-red-300"
            >
              {enviando ? "..." : "Sí"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-500 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 md:px-4 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-red-300"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 sm:hidden"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:inline">Desconectar</span>
          </button>
        )}
      </div>
    </header>
  );
}
