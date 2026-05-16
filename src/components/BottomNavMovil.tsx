"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNavMovil({
  idCuenta,
  onAbrirMenu,
}: {
  idCuenta: string;
  onAbrirMenu: () => void;
}) {
  const pathname = usePathname();
  const b = `/app/cuentas/${idCuenta}`;

  const activo = (segmento: string) =>
    pathname.includes(segmento)
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-zinc-400 dark:text-zinc-600";

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-16 items-center justify-around border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          href={`${b}/dashboard`}
          className={`flex flex-col items-center gap-0.5 px-4 ${activo("/dashboard")}`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-[9px] uppercase tracking-[0.12em]">Dashboard</span>
        </Link>

        <Link
          href={`${b}/conversaciones`}
          className={`flex flex-col items-center gap-0.5 px-4 ${activo("/conversaciones")}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-[9px] uppercase tracking-[0.12em]">Chats</span>
        </Link>

        <Link
          href={`${b}/agenda`}
          className={`flex flex-col items-center gap-0.5 px-4 ${activo("/agenda")}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="text-[9px] uppercase tracking-[0.12em]">Agenda</span>
        </Link>

        <button
          type="button"
          onClick={onAbrirMenu}
          className="flex flex-col items-center gap-0.5 px-4 text-zinc-400 dark:text-zinc-600"
          aria-label="Abrir menú"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="text-[9px] uppercase tracking-[0.12em]">Más</span>
        </button>
      </div>
    </div>
  );
}
