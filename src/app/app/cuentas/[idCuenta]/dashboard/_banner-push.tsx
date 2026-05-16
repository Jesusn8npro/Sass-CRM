"use client";

import { useState } from "react";
import { usePushNotificaciones } from "@/hooks/usePushNotificaciones";

export function BannerPushNotificaciones({ idCuenta }: { idCuenta: string }) {
  const { estado, suscribir } = usePushNotificaciones(idCuenta);
  const [descartado, setDescartado] = useState(false);

  if (estado !== "inactivo" || descartado) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-500/20 bg-zinc-900 px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-emerald-400"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <p className="truncate text-xs text-zinc-300">
          Activar notificaciones para saber cuándo hay clientes esperando
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={suscribir}
          className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
        >
          Activar
        </button>
        <button
          type="button"
          onClick={() => setDescartado(true)}
          aria-label="Cerrar"
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ×
        </button>
      </div>
    </div>
  );
}
