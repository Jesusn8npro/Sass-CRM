"use client";

/**
 * Wrapper responsive del layout `/app/cuentas/[idCuenta]/...`.
 *
 * Patrón estándar de dashboard SaaS (Linear, Vercel, Notion):
 * - Mobile: topbar fija con hamburger + sidebar como drawer + backdrop
 * - Desktop (lg+): sidebar estático visible, topbar oculta
 *
 * El sidebar se cierra automáticamente al navegar (via SidebarPanel
 * onCerrar) y al presionar Escape.
 */

import { useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";
import { PillCreditos } from "./PillCreditos";
import { SidebarPanel } from "./SidebarPanel";

export function LayoutShellMovil({
  idCuenta,
  cuentas,
  children,
}: {
  idCuenta: string;
  cuentas: Cuenta[];
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    function alPresionar(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto]);

  // Bloquear scroll del body cuando el drawer está abierto en mobile.
  useEffect(() => {
    if (!abierto) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [abierto]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <SidebarPanel
        idCuentaActual={idCuenta}
        cuentas={cuentas}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />

      {/* Backdrop — sólo mobile, sólo cuando el drawer está abierto */}
      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setAbierto(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar mobile — desaparece en desktop */}
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/80 px-3 py-2.5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 lg:hidden">
          <button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={abierto}
            aria-controls="sidebar-principal"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-sm">
            S
          </div>
          <span className="text-sm font-bold tracking-tight">Sass-CRM</span>
          <div className="ml-auto">
            <PillCreditos idCuenta={idCuenta} />
          </div>
        </div>

        <main className="flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
