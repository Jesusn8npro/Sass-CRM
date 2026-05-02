"use client";

import { useState } from "react";

/**
 * Botón "Cerrar sesión" que postea al endpoint de logout y vuelve
 * al landing.
 */
export function CerrarSesionBoton() {
  const [cerrando, setCerrando] = useState(false);

  function cerrar() {
    if (cerrando) return;
    setCerrando(true);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/cerrar-sesion";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <button
      type="button"
      onClick={cerrar}
      disabled={cerrando}
      className="flex items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all hover:border-red-400 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      {cerrando ? "Cerrando…" : "Cerrar sesión"}
    </button>
  );
}
