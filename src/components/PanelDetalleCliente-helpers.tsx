"use client";

import { useState } from "react";
import type { Etiqueta } from "@/lib/baseDatos";

export const COLORES_ETIQUETA = [
  { id: "zinc", clase: "bg-zinc-500" },
  { id: "rojo", clase: "bg-red-500" },
  { id: "ambar", clase: "bg-amber-500" },
  { id: "amarillo", clase: "bg-yellow-500" },
  { id: "esmeralda", clase: "bg-emerald-500" },
  { id: "azul", clase: "bg-blue-500" },
  { id: "violeta", clase: "bg-violet-500" },
  { id: "rosa", clase: "bg-pink-500" },
];

const COLORES_TAGS = [
  "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30",
  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30",
  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30",
  "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30",
  "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-500/30",
  "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-500/30",
  "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-500/30",
  "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-500/30",
];

export function colorTag(nombre: string): string {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) | 0;
  return COLORES_TAGS[Math.abs(h) % COLORES_TAGS.length]!;
}

export function clasesPillEtiqueta(color: string): string {
  switch (color) {
    case "rojo":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    case "ambar":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "amarillo":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300";
    case "esmeralda":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "azul":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "violeta":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "rosa":
      return "bg-pink-500/15 text-pink-700 dark:text-pink-300";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  }
}

export function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

export function Dato({
  label,
  valor,
  mono,
}: {
  label: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span
        className={`truncate text-right text-xs ${mono ? "font-mono" : "font-medium"} text-zinc-700 dark:text-zinc-300`}
      >
        {valor}
      </span>
    </div>
  );
}

export function GestionEtiquetas({
  asignadas,
  todasEtiquetas,
  idsAsignadas,
  alternarEtiqueta,
  nombreNuevaEt,
  setNombreNuevaEt,
  colorNuevaEt,
  setColorNuevaEt,
  creandoEtiqueta,
  crearEtiqueta,
}: {
  asignadas: Etiqueta[];
  todasEtiquetas: Etiqueta[];
  idsAsignadas: Set<string>;
  alternarEtiqueta: (e: Etiqueta) => void;
  nombreNuevaEt: string;
  setNombreNuevaEt: (v: string) => void;
  colorNuevaEt: string;
  setColorNuevaEt: (v: string) => void;
  creandoEtiqueta: boolean;
  crearEtiqueta: () => Promise<void> | void;
}) {
  const [agregandoInline, setAgregandoInline] = useState(false);

  return (
    <Seccion titulo="Etiquetas">
      <div className="flex flex-wrap items-center gap-1.5">
        {asignadas.map((e) => (
          <span
            key={e.id}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorTag(e.nombre)}`}
          >
            {e.nombre}
            <button
              type="button"
              onClick={() => alternarEtiqueta(e)}
              title="Quitar etiqueta"
              className="ml-0.5 rounded-full opacity-60 hover:opacity-100 focus:outline-none"
              aria-label={`Quitar ${e.nombre}`}
            >
              ×
            </button>
          </span>
        ))}
        {!agregandoInline && (
          <button
            type="button"
            onClick={() => setAgregandoInline(true)}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-300 text-zinc-400 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
            title="Agregar etiqueta"
          >
            <span className="text-xs leading-none">+</span>
          </button>
        )}
      </div>

      {agregandoInline && (
        <div className="mt-2 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          {todasEtiquetas.filter((e) => !idsAsignadas.has(e.id)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {todasEtiquetas
                .filter((e) => !idsAsignadas.has(e.id))
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      void alternarEtiqueta(e);
                      setAgregandoInline(false);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-75 transition-opacity hover:opacity-100 ${colorTag(e.nombre)}`}
                  >
                    + {e.nombre}
                  </button>
                ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={nombreNuevaEt}
              onChange={(e) => setNombreNuevaEt(e.target.value)}
              placeholder="Nueva etiqueta…"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void crearEtiqueta();
                  setAgregandoInline(false);
                }
                if (e.key === "Escape") setAgregandoInline(false);
              }}
            />
            <button
              type="button"
              onClick={() => {
                void crearEtiqueta();
                setAgregandoInline(false);
              }}
              disabled={!nombreNuevaEt.trim() || creandoEtiqueta}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creandoEtiqueta ? "…" : "Agregar"}
            </button>
            <button
              type="button"
              onClick={() => setAgregandoInline(false)}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLORES_ETIQUETA.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorNuevaEt(c.id)}
                className={`h-4 w-4 rounded-full ${c.clase} ${
                  colorNuevaEt === c.id
                    ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-200"
                    : ""
                }`}
                title={c.id}
              />
            ))}
          </div>
        </div>
      )}
    </Seccion>
  );
}
