"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Badge en sidebar con count de notificaciones no leídas. Polling
 * cada 30s. Click → /app/notificaciones.
 */
export function BadgeNotificaciones() {
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const res = await fetch("/api/notificaciones", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { no_leidas: number };
        if (!cancelado) setNoLeidas(data.no_leidas);
      } catch {
        // ignorar
      }
    }
    void cargar();
    const t = setInterval(() => void cargar(), 30_000);
    return () => {
      cancelado = true;
      clearInterval(t);
    };
  }, []);

  return (
    <Link
      href="/app/notificaciones"
      className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      title={
        noLeidas > 0
          ? `${noLeidas} notificación${noLeidas === 1 ? "" : "es"} no leída${noLeidas === 1 ? "" : "s"}`
          : "Notificaciones"
      }
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
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {noLeidas > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
          {noLeidas > 9 ? "9+" : noLeidas}
        </span>
      )}
    </Link>
  );
}
