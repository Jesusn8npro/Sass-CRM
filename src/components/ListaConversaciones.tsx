"use client";

import type {
  ConversacionConPreview,
  EtiquetaResumen,
} from "@/lib/baseDatos";

function clasesPillEtiqueta(color: string): string {
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

function PillEtiqueta({ etiqueta }: { etiqueta: EtiquetaResumen }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${clasesPillEtiqueta(etiqueta.color)}`}
    >
      {etiqueta.nombre}
    </span>
  );
}

interface Props {
  conversaciones: ConversacionConPreview[];
  idSeleccionada: string | null;
  onSeleccionar: (id: string) => void;
}

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const ahora = Date.now();
  const ts = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((ahora - ts) / 1000));
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

function inicialesDe(nombre: string | null, telefono: string): string {
  if (nombre) {
    const partes = nombre.trim().split(/\s+/);
    const i1 = partes[0]?.[0] ?? "";
    const i2 = partes[1]?.[0] ?? "";
    return (i1 + i2).toUpperCase() || telefono.slice(-2);
  }
  return telefono.slice(-2);
}

export function ListaConversaciones({
  conversaciones,
  idSeleccionada,
  onSeleccionar,
}: Props) {
  if (conversaciones.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-8 dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
            Sin conversaciones todavía
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
            Cuando alguien te escriba, aparecerá aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 px-2 py-2">
      {conversaciones.map((c) => {
        const seleccionada = c.id === idSeleccionada;
        const esIA = c.modo === "IA";
        const necesitaHumano = !!c.necesita_humano;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(c.id)}
              className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                seleccionada
                  ? "border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800/60"
                  : necesitaHumano
                  ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                  : "border-transparent hover:border-zinc-200 hover:bg-white/60 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/50"
              }`}
            >
              <div
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide ring-1 ${
                  esIA
                    ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300"
                }`}
              >
                {inicialesDe(c.nombre, c.telefono)}
                {necesitaHumano && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-white dark:ring-zinc-950"
                    title="Necesita atención humana"
                  >
                    <span className="h-1.5 w-1.5 animate-pulso-suave rounded-full bg-white" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {c.nombre ?? c.telefono}
                  </p>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                    {tiempoRelativo(c.ultimo_mensaje_en)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">
                  {c.vista_previa_ultimo_mensaje ?? "Sin mensajes"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {necesitaHumano && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                      <span className="h-1 w-1 animate-pulso-suave rounded-full bg-red-500" />
                      Atención
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      esIA
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    <span
                      className={`h-1 w-1 rounded-full ${
                        esIA ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {esIA ? "IA" : "Humano"}
                  </span>
                  {(c.etiquetas ?? []).map((e) => (
                    <PillEtiqueta key={e.id} etiqueta={e} />
                  ))}
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">
                    +{c.telefono}
                  </span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
