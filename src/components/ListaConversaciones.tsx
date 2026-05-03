"use client";

import type { ConversacionConPreview } from "@/lib/baseDatos";

interface Props {
  conversaciones: ConversacionConPreview[];
  idSeleccionada: string | null;
  onSeleccionar: (id: string) => void;
}

/** Timestamp tipo Talos: "ahora" si <60s, "HH:MM" si hoy, "ayer", o
 * fecha corta "DD/MM" para días anteriores. */
function tiempoCorto(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora.getTime() - d.getTime();
  if (diffMs < 60_000) return "ahora";
  const esHoy =
    d.getFullYear() === ahora.getFullYear() &&
    d.getMonth() === ahora.getMonth() &&
    d.getDate() === ahora.getDate();
  if (esHoy) {
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  const esAyer =
    d.getFullYear() === ayer.getFullYear() &&
    d.getMonth() === ayer.getMonth() &&
    d.getDate() === ayer.getDate();
  if (esAyer) return "ayer";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

/** Toma 1 sola letra del nombre real capturado, o nombre WhatsApp, o
 * la última letra del teléfono. Igual que Talos. */
function inicialDe(
  nombreReal: string | null | undefined,
  nombreWa: string | null,
  telefono: string,
): string {
  const fuente = nombreReal?.trim() || nombreWa?.trim() || "";
  if (fuente) return fuente.trim()[0]!.toUpperCase();
  return telefono.slice(-1) || "?";
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
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Cuando alguien te escriba, aparecerá aquí.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {conversaciones.map((c) => {
        const seleccionada = c.id === idSeleccionada;
        const esIA = c.modo === "IA";
        const necesitaHumano = !!c.necesita_humano;
        const sinLeer = c.mensajes_nuevos ?? 0;
        const ultimoFueDelOperador =
          c.vista_previa_rol === "asistente" || c.vista_previa_rol === "humano";

        const nombreReal = c.datos_capturados?.nombre?.trim();
        const nombreMostrable = nombreReal || c.nombre || `+${c.telefono}`;
        const inicial = inicialDe(nombreReal, c.nombre, c.telefono);

        const previewBruto = c.vista_previa_ultimo_mensaje ?? "";
        const previewTexto = previewBruto.trim();

        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(c.id)}
              className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                seleccionada
                  ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              }`}
            >
              {/* Avatar circular grande con 1 letra + badge sin-leer */}
              <div className="relative shrink-0">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-base font-semibold text-white shadow-sm"
                  aria-hidden
                >
                  {inicial}
                </div>
                {sinLeer > 0 && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950"
                    title={`${sinLeer} sin responder`}
                  >
                    {sinLeer > 9 ? "9+" : sinLeer}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {/* Línea 1: nombre + timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`truncate text-sm ${
                      sinLeer > 0
                        ? "font-bold text-zinc-900 dark:text-zinc-50"
                        : "font-semibold text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {nombreMostrable}
                  </p>
                  <span
                    className={`shrink-0 text-[11px] ${
                      sinLeer > 0
                        ? "font-semibold text-emerald-700 dark:text-emerald-400"
                        : "font-medium text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {tiempoCorto(c.ultimo_mensaje_en)}
                  </span>
                </div>

                {/* Línea 2: preview + pill IA/H */}
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p
                    className={`min-w-0 truncate text-xs ${
                      sinLeer > 0
                        ? "font-semibold text-zinc-700 dark:text-zinc-200"
                        : "text-zinc-500 dark:text-zinc-500"
                    }`}
                  >
                    {ultimoFueDelOperador && (
                      <span className="font-medium text-zinc-500 dark:text-zinc-500">
                        Tu:{" "}
                      </span>
                    )}
                    {previewTexto || "Sin mensajes"}
                  </p>
                  {/* Pill mini IA / H / Atender */}
                  {necesitaHumano ? (
                    <span
                      className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300"
                      title="Necesita atención humana"
                    >
                      ⚠
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        esIA
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                      }`}
                    >
                      {esIA ? "IA" : "H"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
