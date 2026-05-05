"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface OpcionesConfirm {
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  variante?: "neutro" | "peligro";
}

type ResolverConfirm = (confirmado: boolean) => void;

interface ContextoConfirm {
  /** Devuelve `true` si el usuario aceptó. Reemplazo de window.confirm. */
  confirmar: (opciones: OpcionesConfirm) => Promise<boolean>;
}

const Ctx = createContext<ContextoConfirm | null>(null);

export function useConfirm(): ContextoConfirm {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmDialogProvider>");
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ opciones: OpcionesConfirm } | null>(null);
  const resolverRef = useRef<ResolverConfirm | null>(null);

  const confirmar = useCallback((opciones: OpcionesConfirm) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setEstado({ opciones });
    });
  }, []);

  const cerrar = useCallback((confirmado: boolean) => {
    resolverRef.current?.(confirmado);
    resolverRef.current = null;
    setEstado(null);
  }, []);

  useEffect(() => {
    if (!estado) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(false);
      if (e.key === "Enter") cerrar(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [estado, cerrar]);

  return (
    <Ctx.Provider value={{ confirmar }}>
      {children}
      {estado && <Dialog opciones={estado.opciones} onCerrar={cerrar} />}
    </Ctx.Provider>
  );
}

function Dialog({ opciones, onCerrar }: { opciones: OpcionesConfirm; onCerrar: (ok: boolean) => void }) {
  const peligro = opciones.variante === "peligro";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-aparecer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <h2 id="confirm-titulo" className="text-lg font-semibold text-white">
          {opciones.titulo ?? "Confirmar"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{opciones.mensaje}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onCerrar(false)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:border-white/40 hover:bg-white/[0.04]"
          >
            {opciones.textoCancelar ?? "Cancelar"}
          </button>
          <button
            type="button"
            onClick={() => onCerrar(true)}
            autoFocus
            className={`rounded-full px-4 py-2 text-sm font-semibold shadow-md transition-all ${
              peligro
                ? "bg-red-500 text-white shadow-red-500/30 hover:bg-red-400"
                : "bg-emerald-400 text-black shadow-emerald-500/30 hover:bg-emerald-300"
            }`}
          >
            {opciones.textoConfirmar ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
