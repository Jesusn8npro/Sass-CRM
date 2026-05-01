"use client";

import { useState } from "react";
import Link from "next/link";
import type { Cuenta } from "@/lib/baseDatos";

interface Props {
  cuenta: Cuenta;
  onDesconectar: () => void;
}

export function EncabezadoCuenta({
  cuenta,
  onDesconectar,
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
    <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex items-center gap-3 min-w-0">
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
          <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
            {cuenta.telefono ? `+${cuenta.telefono}` : "sin conectar"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/cuentas/${cuenta.id}/configuracion`}
          className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 px-4 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
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
          Ajustes
        </Link>

        {confirmando ? (
          <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-1">
            <span className="px-3 text-xs text-red-700 dark:text-red-300">
              ¿Desconectar?
            </span>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-full px-3 py-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={desconectar}
              disabled={enviando}
              className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-500/30 disabled:opacity-50 dark:text-red-300"
            >
              {enviando ? "..." : "Sí"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-red-300"
          >
            Desconectar
          </button>
        )}
      </div>
    </header>
  );
}
