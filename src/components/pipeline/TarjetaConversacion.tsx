"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import type { ConversacionConPreview } from "@/lib/baseDatos";

interface Props {
  conversacion: ConversacionConPreview;
  idCuenta: string;
  /** True cuando se renderiza dentro del DragOverlay */
  arrastrando?: boolean;
}

const CLASE_COLOR_PILL: Record<string, string> = {
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  rojo: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  ambar: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  amarillo:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300",
  esmeralda:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  azul: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  violeta:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  rosa: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
};

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "—";
  const ahora = Date.now();
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((ahora - ts) / 1000));
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function inicialesNombre(nombre: string | null, telefono: string): string {
  const fuente = (nombre ?? telefono).trim();
  const partes = fuente.split(/\s+/);
  if (partes.length >= 2) {
    return (partes[0]![0]! + partes[1]![0]!).toUpperCase();
  }
  return fuente.slice(0, 2).toUpperCase();
}

export function TarjetaConversacion({
  conversacion,
  idCuenta,
  arrastrando = false,
}: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: conversacion.id,
  });

  const preview =
    conversacion.vista_previa_ultimo_mensaje?.trim() || "—";
  const previewLimpio = preview.replace(/^\[.*?\]\s*/, "").slice(0, 80);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group select-none rounded-xl border bg-white p-3 transition-shadow dark:bg-zinc-950 ${
        isDragging
          ? "opacity-30"
          : "border-zinc-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
      } ${arrastrando ? "shadow-2xl ring-2 ring-emerald-500/40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {inicialesNombre(conversacion.nombre, conversacion.telefono)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {conversacion.nombre ?? `+${conversacion.telefono}`}
            </p>
            <span className="shrink-0 text-[10px] text-zinc-400">
              {tiempoRelativo(conversacion.ultimo_mensaje_en)}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
            +{conversacion.telefono}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            {previewLimpio}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        <div className="flex flex-wrap gap-1">
          {conversacion.necesita_humano && (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-700 dark:bg-red-500/20 dark:text-red-300">
              Atención
            </span>
          )}
          {conversacion.etiquetas.slice(0, 2).map((et) => (
            <span
              key={et.id}
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                CLASE_COLOR_PILL[et.color] ?? CLASE_COLOR_PILL.zinc
              }`}
            >
              {et.nombre}
            </span>
          ))}
          {conversacion.etiquetas.length > 2 && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              +{conversacion.etiquetas.length - 2}
            </span>
          )}
        </div>
        <Link
          href={`/app?cuenta=${idCuenta}&conv=${conversacion.id}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 rounded-full p-1 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
          title="Abrir chat"
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
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
