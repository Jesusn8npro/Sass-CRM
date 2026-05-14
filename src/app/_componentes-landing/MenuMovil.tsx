"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ItemMenu {
  href: string;
  label: string;
}

/**
 * Menú hamburguesa para mobile en la landing pública.
 * Visible solo en pantallas <md. Cierra con Escape, click afuera o
 * navegación. Bloquea scroll del body mientras está abierto.
 */
export function MenuMovil({ items }: { items: ItemMenu[] }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={abierto}
        aria-controls="menu-movil-panel"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-white/80 transition-colors hover:border-emerald-400/40 hover:text-white md:hidden"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className="h-4 w-4"
        >
          {abierto ? (
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path d="M3 6h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú principal"
        >
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 h-full w-full bg-black/80 backdrop-blur-md"
          />
          <div
            id="menu-movil-panel"
            className="absolute inset-x-0 top-0 z-10 border-b border-white/[0.06] bg-black/95 px-6 pb-8 pt-20 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <ul className="flex flex-col gap-1">
              {items.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setAbierto(false)}
                    className="flex items-center justify-between rounded-xl border border-transparent px-4 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-white/70 transition-all hover:border-white/[0.06] hover:bg-white/[0.02] hover:text-white"
                  >
                    <span>{l.label}</span>
                    <span className="font-mono text-[10px] text-white/30">→</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-2 border-t border-white/[0.06] pt-6">
              <Link
                href="/login"
                onClick={() => setAbierto(false)}
                className="rounded-full border border-white/10 px-4 py-3 text-center text-sm font-medium tracking-tight text-white/80 transition-colors hover:border-white/30 hover:text-white"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/signup"
                onClick={() => setAbierto(false)}
                className="rounded-full bg-emerald-400 px-4 py-3 text-center text-sm font-semibold tracking-tight text-black shadow-[0_0_28px_-4px_rgba(52,211,153,0.6)] transition-all hover:shadow-[0_0_44px_-4px_rgba(52,211,153,0.9)]"
              >
                Empezar gratis →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
