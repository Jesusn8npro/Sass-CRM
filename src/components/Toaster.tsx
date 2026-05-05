"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Variante = "exito" | "error" | "info" | "advertencia";

interface Toast {
  id: string;
  mensaje: string;
  variante: Variante;
  duracionMs: number;
}

interface ContextoToasts {
  mostrar: (mensaje: string, variante?: Variante, duracionMs?: number) => void;
  exito: (mensaje: string, duracionMs?: number) => void;
  error: (mensaje: string, duracionMs?: number) => void;
  info: (mensaje: string, duracionMs?: number) => void;
}

const Ctx = createContext<ContextoToasts | null>(null);

export function useToast(): ContextoToasts {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast debe usarse dentro de <Toaster>");
  return ctx;
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remover = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const mostrar = useCallback(
    (mensaje: string, variante: Variante = "info", duracionMs = 4000) => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((t) => [...t, { id, mensaje, variante, duracionMs }]);
    },
    [],
  );

  const valor: ContextoToasts = {
    mostrar,
    exito: (m, d) => mostrar(m, "exito", d),
    error: (m, d) => mostrar(m, "error", d ?? 6000),
    info: (m, d) => mostrar(m, "info", d),
  };

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onCerrar={() => remover(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onCerrar }: { toast: Toast; onCerrar: () => void }) {
  useEffect(() => {
    const id = setTimeout(onCerrar, toast.duracionMs);
    return () => clearTimeout(id);
  }, [onCerrar, toast.duracionMs]);

  const estilos: Record<Variante, string> = {
    exito:
      "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-100",
    error: "border-red-400/30 bg-red-400/[0.08] text-red-100",
    info: "border-white/15 bg-white/[0.06] text-white",
    advertencia:
      "border-amber-400/30 bg-amber-400/[0.08] text-amber-100",
  };
  const iconos: Record<Variante, string> = {
    exito: "✓",
    error: "✕",
    info: "i",
    advertencia: "!",
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md animate-aparecer ${estilos[toast.variante]}`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current font-mono text-[11px] font-semibold text-black/80"
      >
        {iconos[toast.variante]}
      </span>
      <p className="flex-1 text-sm leading-snug">{toast.mensaje}</p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar notificación"
        className="text-current/60 hover:text-current"
      >
        ×
      </button>
    </div>
  );
}
