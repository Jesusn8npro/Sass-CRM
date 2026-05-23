"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6">
      {/* Grid de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right,rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.025) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Orb rojo ambiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle,rgba(239,68,68,0.12) 0%,rgba(239,68,68,0.03) 55%,transparent 72%)",
        }}
      />

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        {/* Ícono */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/[0.08]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-8 w-8 text-red-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-500">
          // error del sistema
        </p>
        <h1 className="font-display mt-3 text-5xl italic leading-tight text-white md:text-6xl">
          Algo salió
          <br />
          mal.
        </h1>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-400">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al
          inicio.
        </p>

        {error.digest && (
          <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 font-mono text-[11px] text-zinc-600">
            ref · {error.digest}
          </p>
        )}

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="rounded-full bg-emerald-500 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            Reintentar
          </button>
          <Link
            href="/app"
            className="rounded-full border border-zinc-700 px-7 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Ir al inicio →
          </Link>
        </div>

        <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-700">
          INYECTAIA · soporte disponible
        </p>
      </div>
    </main>
  );
}
