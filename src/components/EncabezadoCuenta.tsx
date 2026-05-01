"use client";

import { useEffect, useRef, useState } from "react";
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
  const [menuAbierto, setMenuAbierto] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alClick(e: MouseEvent) {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClick);
    return () => document.removeEventListener("mousedown", alClick);
  }, []);

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
    <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-3 py-3 backdrop-blur-md md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950/80">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span className="hidden md:inline">Dashboard</span>
        </Link>

        {/* Menú desplegable con el resto */}
        <div className="relative" ref={refMenu}>
          <button
            type="button"
            onClick={() => setMenuAbierto((v) => !v)}
            title="Más opciones"
            className="flex h-9 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
            <span className="hidden md:inline">Más</span>
          </button>
          {menuAbierto && (
            <div className="absolute right-0 top-full z-[60] mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <ItemMenu
                href={`/cuentas/${cuenta.id}/pipeline`}
                onClick={() => setMenuAbierto(false)}
                texto="Pipeline (Kanban)"
                icono="pipeline"
              />
              <ItemMenu
                href={`/cuentas/${cuenta.id}/productos`}
                onClick={() => setMenuAbierto(false)}
                texto="Productos"
                icono="productos"
              />
              <ItemMenu
                href={`/cuentas/${cuenta.id}/llamadas`}
                onClick={() => setMenuAbierto(false)}
                texto="Llamadas"
                icono="telefono"
              />
              <ItemMenu
                href={`/cuentas/${cuenta.id}/inversiones`}
                onClick={() => setMenuAbierto(false)}
                texto="Inversiones"
                icono="dinero"
              />
              <div className="border-t border-zinc-100 dark:border-zinc-800" />
              <ItemMenu
                href={`/cuentas/${cuenta.id}/configuracion`}
                onClick={() => setMenuAbierto(false)}
                texto="Ajustes"
                icono="ajustes"
              />
            </div>
          )}
        </div>

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

function ItemMenu({
  href,
  onClick,
  texto,
  icono,
}: {
  href: string;
  onClick: () => void;
  texto: string;
  icono: "pipeline" | "productos" | "telefono" | "dinero" | "ajustes";
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        <IconoMenu nombre={icono} />
      </span>
      <span>{texto}</span>
    </Link>
  );
}

function IconoMenu({ nombre }: { nombre: string }) {
  const cls = "h-3.5 w-3.5";
  if (nombre === "pipeline") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="10" y="4" width="5" height="10" rx="1" />
        <rect x="17" y="4" width="4" height="6" rx="1" />
      </svg>
    );
  }
  if (nombre === "productos") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
        <path d="M16.5 9.4 7.55 4.24" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    );
  }
  if (nombre === "telefono") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }
  if (nombre === "dinero") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  // ajustes
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
