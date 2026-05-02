"use client";

import { useEffect, useRef, useState } from "react";
import type { Etiqueta } from "@/lib/baseDatos";

function clasesPill(color: string): string {
  switch (color) {
    case "rojo":
      return "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30";
    case "ambar":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30";
    case "amarillo":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 ring-yellow-500/30";
    case "esmeralda":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30";
    case "azul":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30";
    case "violeta":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30";
    case "rosa":
      return "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 ring-zinc-500/30";
  }
}

interface Props {
  idCuenta: string;
  idConversacion: string;
}

interface RespuestaEtiquetasCuenta {
  etiquetas: Etiqueta[];
}
interface RespuestaEtiquetasConversacion {
  etiquetas: Etiqueta[];
}

export function SelectorEtiquetas({ idCuenta, idConversacion }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [todas, setTodas] = useState<Etiqueta[]>([]);
  const [asignadas, setAsignadas] = useState<Etiqueta[]>([]);
  const [enviando, setEnviando] = useState(false);
  const refContainer = useRef<HTMLDivElement>(null);

  // Cargar todas las etiquetas de la cuenta y las asignadas a esta conv
  const cargar = async () => {
    try {
      const [resTodas, resAsig] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}/etiquetas`, { cache: "no-store" }),
        fetch(
          `/api/cuentas/${idCuenta}/conversaciones/${idConversacion}/etiquetas`,
          { cache: "no-store" },
        ),
      ]);
      if (resTodas.ok) {
        const d = (await resTodas.json()) as RespuestaEtiquetasCuenta;
        setTodas(d.etiquetas);
      }
      if (resAsig.ok) {
        const d = (await resAsig.json()) as RespuestaEtiquetasConversacion;
        setAsignadas(d.etiquetas);
      }
    } catch {}
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta, idConversacion]);

  useEffect(() => {
    if (!abierto) return;
    function alClick(e: MouseEvent) {
      if (
        refContainer.current &&
        !refContainer.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    }
    const t = setTimeout(() => {
      document.addEventListener("mousedown", alClick);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", alClick);
    };
  }, [abierto]);

  const idsAsignadas = new Set(asignadas.map((e) => e.id));

  async function alternar(etiqueta: Etiqueta) {
    if (enviando) return;
    setEnviando(true);
    const yaTengo = idsAsignadas.has(etiqueta.id);
    try {
      if (yaTengo) {
        await fetch(
          `/api/cuentas/${idCuenta}/conversaciones/${idConversacion}/etiquetas?etiqueta_id=${etiqueta.id}`,
          { method: "DELETE" },
        );
      } else {
        await fetch(
          `/api/cuentas/${idCuenta}/conversaciones/${idConversacion}/etiquetas`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ etiqueta_id: etiqueta.id }),
          },
        );
      }
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div ref={refContainer} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        title="Asignar etiquetas"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        {asignadas.length > 0 ? (
          <span>
            {asignadas.length}{" "}
            {asignadas.length === 1 ? "etiqueta" : "etiquetas"}
          </span>
        ) : (
          <span>Etiquetar</span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Etiquetas
            </p>
          </div>
          {todas.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-zinc-500">
              No hay etiquetas creadas. Creá algunas en{" "}
              <span className="font-semibold">Ajustes → Etiquetas</span>.
            </div>
          ) : (
            <ul className="max-h-[280px] overflow-y-auto py-1">
              {todas.map((e) => {
                const activa = idsAsignadas.has(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => alternar(e)}
                      disabled={enviando}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800/60"
                    >
                      <span
                        className={`inline-flex flex-1 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${clasesPill(e.color)}`}
                      >
                        {e.nombre}
                      </span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          activa
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        {activa && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-3 w-3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
