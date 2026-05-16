"use client";

import { useEffect, useRef } from "react";

export function BarraProgresoLectura() {
  const barraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const barra = barraRef.current;
    if (!barra) return;

    function actualizar() {
      const scrollY = window.scrollY;
      const alturaDocumento = document.documentElement.scrollHeight - window.innerHeight;
      const progreso = alturaDocumento > 0 ? (scrollY / alturaDocumento) * 100 : 0;
      if (barra) barra.style.width = `${Math.min(100, progreso)}%`;
    }

    window.addEventListener("scroll", actualizar, { passive: true });
    actualizar();
    return () => window.removeEventListener("scroll", actualizar);
  }, []);

  return (
    <div className="fixed left-0 top-0 z-50 h-[2px] w-full bg-zinc-800/60">
      <div
        ref={barraRef}
        className="h-full w-0 bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)] transition-none"
      />
    </div>
  );
}
