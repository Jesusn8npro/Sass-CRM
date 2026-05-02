"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { ConversacionConPreview } from "@/lib/baseDatos";
import { TarjetaConversacion } from "./TarjetaConversacion";

interface ColorOpcion {
  id: string;
  clase: string;
}

interface Props {
  idEtapa: string | "sin";
  titulo: string;
  color: string;
  conversaciones: ConversacionConPreview[];
  idCuenta: string;
  onRenombrar?: (nuevo: string) => void;
  onBorrar?: () => void;
  onCambiarColor?: (color: string) => void;
  colores?: ColorOpcion[];
  /** Solo lectura: para la columna 'Sin asignar' */
  deshabilitarEdicion?: boolean;
}

const CLASE_COLOR_BORDE: Record<string, string> = {
  zinc: "border-l-zinc-400",
  rojo: "border-l-red-500",
  ambar: "border-l-amber-500",
  amarillo: "border-l-yellow-500",
  esmeralda: "border-l-emerald-500",
  azul: "border-l-blue-500",
  violeta: "border-l-violet-500",
  rosa: "border-l-pink-500",
};

const CLASE_COLOR_DOT: Record<string, string> = {
  zinc: "bg-zinc-400",
  rojo: "bg-red-500",
  ambar: "bg-amber-500",
  amarillo: "bg-yellow-500",
  esmeralda: "bg-emerald-500",
  azul: "bg-blue-500",
  violeta: "bg-violet-500",
  rosa: "bg-pink-500",
};

export function ColumnaPipeline({
  idEtapa,
  titulo,
  color,
  conversaciones,
  idCuenta,
  onRenombrar,
  onBorrar,
  onCambiarColor,
  colores,
  deshabilitarEdicion = false,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: idEtapa });
  const [editando, setEditando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState(titulo);
  const [paletaAbierta, setPaletaAbierta] = useState(false);

  const colorBorde = CLASE_COLOR_BORDE[color] ?? CLASE_COLOR_BORDE.zinc;
  const colorDot = CLASE_COLOR_DOT[color] ?? CLASE_COLOR_DOT.zinc;

  return (
    <div
      ref={setNodeRef}
      className={`flex h-fit max-h-[calc(100vh-180px)] w-72 shrink-0 flex-col rounded-2xl border-l-4 bg-white shadow-sm transition-colors dark:bg-zinc-900 ${colorBorde} ${
        isOver ? "ring-2 ring-emerald-500/40" : ""
      }`}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-100 bg-white/95 px-3 py-2.5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`h-2 w-2 shrink-0 rounded-full ${colorDot}`} />
          {editando && !deshabilitarEdicion ? (
            <input
              type="text"
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              onBlur={() => {
                if (nombreNuevo.trim() && nombreNuevo.trim() !== titulo) {
                  onRenombrar?.(nombreNuevo.trim());
                }
                setEditando(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setNombreNuevo(titulo);
                  setEditando(false);
                }
              }}
              autoFocus
              className="flex-1 rounded bg-transparent text-sm font-semibold text-zinc-900 focus:outline-none dark:text-zinc-100"
            />
          ) : (
            <button
              type="button"
              onClick={() => !deshabilitarEdicion && setEditando(true)}
              className="truncate text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              disabled={deshabilitarEdicion}
            >
              {titulo}
            </button>
          )}
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {conversaciones.length}
          </span>
        </div>

        {!deshabilitarEdicion && (
          <div className="flex shrink-0 items-center gap-1">
            {onCambiarColor && colores && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPaletaAbierta((v) => !v)}
                  className={`h-5 w-5 rounded-full ${colorDot} ring-1 ring-zinc-200 dark:ring-zinc-700`}
                  title="Cambiar color"
                />
                {paletaAbierta && (
                  <div className="absolute right-0 top-7 z-20 flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    {colores.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          onCambiarColor(c.id);
                          setPaletaAbierta(false);
                        }}
                        className={`h-5 w-5 rounded-full ${c.clase} ${
                          color === c.id
                            ? "ring-2 ring-offset-1 ring-zinc-900 dark:ring-zinc-100"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            {onBorrar && (
              <button
                type="button"
                onClick={onBorrar}
                title="Borrar etapa"
                className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {conversaciones.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-zinc-200 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
            Soltá una tarjeta acá
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversaciones.map((c) => (
              <TarjetaConversacion
                key={c.id}
                conversacion={c}
                idCuenta={idCuenta}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
