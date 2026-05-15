"use client";

import Link from "next/link";

export function SeccionNav({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-texto-tenue">
        {titulo}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

export function ItemNav({
  icono,
  etiqueta,
  href,
  actual,
  matchPaths,
}: {
  icono: React.ReactNode;
  etiqueta: string;
  href: string;
  actual: string | null;
  matchPaths?: string[];
}) {
  const candidatos = matchPaths ?? [href.split("/").pop() ?? ""];
  const activo = !!actual && candidatos.some((p) => actual.includes(p));
  return (
    <li className="relative">
      {activo && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
        />
      )}
      <Link
        href={href}
        className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs transition-all ${
          activo
            ? "bg-gradient-to-r from-emerald-500/10 to-transparent font-semibold text-emerald-700 dark:text-emerald-300"
            : "text-zinc-600 hover:translate-x-0.5 hover:bg-zinc-100/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100"
        }`}
      >
        <span
          className={`shrink-0 transition-transform ${activo ? "scale-110" : "group-hover:scale-105"}`}
        >
          {icono}
        </span>
        <span className="truncate">{etiqueta}</span>
      </Link>
    </li>
  );
}
