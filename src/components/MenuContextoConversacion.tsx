"use client";

import { useEffect, useRef } from "react";

interface AccionMenu {
  etiqueta: string;
  icono: string;
  onClick: () => void;
  destructiva?: boolean;
}

interface Props {
  /** Coordenadas del click/touch que abrió el menú. */
  posicion: { x: number; y: number };
  acciones: AccionMenu[];
  onCerrar: () => void;
}

/**
 * Popup contextual ligero. Se posiciona donde se disparó el evento.
 * Click afuera o ESC cierra. Auto-ajusta si se sale por la derecha
 * o por abajo del viewport.
 */
export function MenuContextoConversacion({
  posicion,
  acciones,
  onCerrar,
}: Props) {
  const refMenu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function afuera(e: Event) {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) {
        onCerrar();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    // Delay para no agarrar el click que abrió el menú
    const t = setTimeout(() => {
      document.addEventListener("mousedown", afuera);
      document.addEventListener("touchstart", afuera);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", afuera);
      document.removeEventListener("touchstart", afuera);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCerrar]);

  // Auto-ajuste para que no salga del viewport
  const ANCHO = 200;
  const ALTO_APROX = acciones.length * 40 + 8;
  let x = posicion.x;
  let y = posicion.y;
  if (typeof window !== "undefined") {
    if (x + ANCHO > window.innerWidth - 8) x = window.innerWidth - ANCHO - 8;
    if (y + ALTO_APROX > window.innerHeight - 8) {
      y = window.innerHeight - ALTO_APROX - 8;
    }
    if (x < 8) x = 8;
    if (y < 8) y = 8;
  }

  return (
    <div
      ref={refMenu}
      role="menu"
      style={{ left: x, top: y, width: ANCHO }}
      className="fixed z-50 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {acciones.map((a, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={() => {
            a.onClick();
            onCerrar();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
            a.destructiva
              ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
              : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          <span className="text-base">{a.icono}</span>
          <span>{a.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
