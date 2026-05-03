"use client";

/**
 * Helpers + sub-componentes de PanelDetalleCliente extraídos para
 * mantener el archivo principal bajo 450 líneas. Solo se usa desde ahí.
 */

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
  return (
    <Seccion titulo="Etiquetas">
      {asignadas.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {asignadas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => alternarEtiqueta(e)}
              title="Quitar etiqueta"
              className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${clasesPillEtiqueta(e.color)}`}
            >
              {e.nombre}
              <span className="opacity-0 group-hover:opacity-100">×</span>
            </button>
          ))}
        </div>
      )}
      <details className="rounded-xl border border-zinc-200 bg-white open:bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:open:bg-zinc-950/40">
        <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/40">
          + Agregar etiqueta
        </summary>
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
          {todasEtiquetas.length > 0 && (
            <>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Existentes
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {todasEtiquetas
                  .filter((e) => !idsAsignadas.has(e.id))
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => alternarEtiqueta(e)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70 transition-opacity hover:opacity-100 ${clasesPillEtiqueta(e.color)}`}
                    >
                      + {e.nombre}
                    </button>
                  ))}
                {todasEtiquetas.filter((e) => !idsAsignadas.has(e.id)).length === 0 && (
                  <span className="text-[10px] text-zinc-400">
                    (Todas las etiquetas existentes ya están asignadas)
                  </span>
                )}
              </div>
            </>
          )}
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Crear nueva
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={nombreNuevaEt}
              onChange={(e) => setNombreNuevaEt(e.target.value)}
              placeholder="Nombre de la etiqueta…"
              className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
              onKeyDown={(e) => {
                if (e.key === "Enter") void crearEtiqueta();
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              {COLORES_ETIQUETA.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColorNuevaEt(c.id)}
                  className={`h-5 w-5 rounded-full ${c.clase} ${
                    colorNuevaEt === c.id
                      ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-200"
                      : ""
                  }`}
                  title={c.id}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={crearEtiqueta}
              disabled={!nombreNuevaEt.trim() || creandoEtiqueta}
              className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creandoEtiqueta ? "Creando…" : "+ Crear y asignar"}
            </button>
          </div>
        </div>
      </details>
    </Seccion>
  );
}
