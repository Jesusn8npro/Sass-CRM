"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface RespuestaCreditos {
  saldo: { saldo_actual: number };
}

/**
 * Badge compacto que muestra el saldo de créditos. Va en el topbar
 * mobile y como item del sidebar. Click → /creditos.
 */
export function PillCreditos({ idCuenta }: { idCuenta: string }) {
  const [saldo, setSaldo] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const res = await fetch(`/api/cuentas/${idCuenta}/creditos`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const d = (await res.json()) as RespuestaCreditos;
        if (!cancelado) setSaldo(d.saldo.saldo_actual);
      } catch {
        /* ignorar */
      }
    }
    cargar();
    const i = setInterval(cargar, 30_000);
    return () => {
      cancelado = true;
      clearInterval(i);
    };
  }, [idCuenta]);

  const bajo = saldo !== null && saldo < 10;

  return (
    <Link
      href={`/app/cuentas/${idCuenta}/creditos`}
      title="Ver créditos"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        bajo
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M9 9h6M9 15h6" />
      </svg>
      <span className="font-mono">{saldo ?? "··"}</span>
    </Link>
  );
}
