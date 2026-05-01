interface Props {
  visible: boolean;
}

export function BannerBotInactivo({ visible }: Props) {
  if (!visible) return null;
  return (
    <div className="border-b border-red-500/30 bg-red-500/10 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-red-700 dark:text-red-300"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            El proceso del bot está inactivo
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-red-700/80 dark:text-red-300/80">
            La conexión figura como activa pero el proceso del bot no está
            corriendo. Los mensajes entrantes no se reciben y los mensajes
            humanos quedan en cola. Reiniciá el proceso ejecutando{" "}
            <code className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[11px]">
              npm run start:bot
            </code>{" "}
            en una terminal.
          </p>
        </div>
      </div>
    </div>
  );
}
