"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { SERVICIOS_NAV } from "./servicios-nav";

export { SERVICIOS_NAV };

export function MenuServicios() {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        aria-haspopup="true"
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-1.5 rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          abierto ? "text-white" : "text-white/55 hover:text-white"
        }`}
      >
        Servicios
        <svg
          viewBox="0 0 10 10"
          fill="none"
          className={`h-2.5 w-2.5 transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-50 mt-3 w-[540px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/95 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl"
          style={{ animation: "aparecer 160ms ease-out both" }}
        >
          {/* Header del dropdown */}
          <div className="border-b border-white/[0.06] px-5 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-400/70">
              // servicios de INYECTAIA
            </p>
          </div>

          {/* Grid de servicios */}
          <div className="grid grid-cols-2 gap-px bg-white/[0.04] p-px">
            {SERVICIOS_NAV.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                role="menuitem"
                onClick={() => setAbierto(false)}
                className="group relative flex flex-col gap-1.5 bg-black/90 p-4 transition-all hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base text-emerald-400/60 transition-colors group-hover:text-emerald-300">
                      {s.icono}
                    </span>
                    <span className="text-[13px] font-medium text-white/90 transition-colors group-hover:text-white">
                      {s.label}
                    </span>
                  </div>
                  {s.tag && (
                    <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-1.5 py-px font-mono text-[8px] uppercase tracking-[0.18em] text-fuchsia-300">
                      {s.tag}
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-white/40 transition-colors group-hover:text-white/55">
                  {s.desc}
                </p>
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-400/60 to-transparent transition-all duration-300 group-hover:w-1/2"
                />
              </Link>
            ))}
          </div>

          {/* Footer del dropdown */}
          <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.01] px-5 py-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
              todos los servicios
            </span>
            <Link
              href="/servicios"
              onClick={() => setAbierto(false)}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Ver todos
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
