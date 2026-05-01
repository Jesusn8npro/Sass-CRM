"use client";

import { useTema } from "@/lib/useTema";

export function InterruptorTema() {
  const { tema, alternar, montado } = useTema();

  if (!montado) {
    return (
      <div
        aria-hidden
        className="h-9 w-9 rounded-full border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      />
    );
  }

  const esOscuro = tema === "oscuro";

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={esOscuro ? "Modo claro" : "Modo oscuro"}
      className="group flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition-all duration-200 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
    >
      <span className="relative h-4 w-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
            esOscuro
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${
            esOscuro
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </span>
    </button>
  );
}
