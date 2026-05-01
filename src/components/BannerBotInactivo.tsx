"use client";

import { useState } from "react";

interface Props {
  visible: boolean;
}

export function BannerBotInactivo({ visible }: Props) {
  const [expandido, setExpandido] = useState(false);
  if (!visible) return null;

  return (
    <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 backdrop-blur-md">
      {/* Versión compacta — siempre visible */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-red-500/15 md:px-6"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-red-700 dark:text-red-300"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        <p className="flex-1 truncate text-xs font-semibold text-red-800 dark:text-red-200">
          Bot inactivo — los mensajes no se reciben
        </p>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-red-700 transition-transform dark:text-red-300 ${expandido ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Versión expandida — opcional al click */}
      {expandido && (
        <div className="border-t border-red-500/20 px-4 py-3 md:px-6">
          <p className="text-xs leading-relaxed text-red-700/80 dark:text-red-300/80">
            La conexión figura como activa pero el proceso del bot no está
            corriendo. Los mensajes entrantes no se reciben y los mensajes
            humanos quedan en cola. Reiniciá el proceso ejecutando{" "}
            <code className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[11px]">
              npm run start:bot
            </code>{" "}
            en una terminal.
          </p>
        </div>
      )}
    </div>
  );
}
