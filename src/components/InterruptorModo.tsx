"use client";

import { useState } from "react";
import type { ModoConversacion } from "@/lib/baseDatos";

interface Props {
  idCuenta: string;
  idConversacion: string;
  modo: ModoConversacion;
  onCambio: (nuevoModo: ModoConversacion) => void;
}

export function InterruptorModo({
  idCuenta,
  idConversacion,
  modo,
  onCambio,
}: Props) {
  const [enviando, setEnviando] = useState(false);

  async function cambiar(nuevo: ModoConversacion) {
    if (nuevo === modo || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/modo/${idConversacion}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modo: nuevo }),
        },
      );
      if (res.ok) onCambio(nuevo);
    } finally {
      setEnviando(false);
    }
  }

  const esIA = modo === "IA";

  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-zinc-200 bg-white/80 p-0.5 backdrop-blur-sm md:gap-1 md:p-1 dark:border-zinc-800 dark:bg-zinc-900/60"
      role="group"
      aria-label="Modo de conversación"
    >
      <button
        type="button"
        onClick={() => cambiar("IA")}
        disabled={enviando}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase transition-all duration-200 disabled:opacity-50 md:gap-2 md:px-4 md:py-1.5 md:text-xs ${
          esIA
            ? "bg-emerald-500/10 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)] dark:text-emerald-300"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            esIA
              ? "bg-emerald-500 animate-pulso-suave"
              : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        />
        IA
      </button>
      <button
        type="button"
        onClick={() => cambiar("HUMANO")}
        disabled={enviando}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase transition-all duration-200 disabled:opacity-50 md:gap-2 md:px-4 md:py-1.5 md:text-xs ${
          !esIA
            ? "bg-amber-500/10 text-amber-700 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)] dark:text-amber-300"
            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            !esIA
              ? "bg-amber-500 animate-pulso-suave"
              : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        />
        Humano
      </button>
    </div>
  );
}
