"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary:app]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.07] dark:border-red-500/20 dark:bg-red-500/[0.05]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-7 w-7 text-red-500 dark:text-red-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-500">
        // error de sección
      </p>
      <h2 className="font-display mt-2 text-3xl italic text-zinc-900 dark:text-white md:text-4xl">
        Algo salió mal.
      </h2>
      <p className="mt-3 max-w-xs text-center text-sm text-zinc-500 dark:text-zinc-400">
        No se pudo cargar esta sección. El resto del panel sigue funcionando.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-[10px] text-zinc-400 dark:text-zinc-600">
          ref · {error.digest}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-400"
        >
          Reintentar
        </button>
        <Link
          href="/app"
          className="rounded-full border border-zinc-200 px-5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
        >
          Panel principal
        </Link>
      </div>
    </div>
  );
}
