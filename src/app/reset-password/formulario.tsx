"use client";

import { useState } from "react";
import { actualizarPassword } from "./acciones";

export function FormularioResetPassword() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSubmit(formData: FormData) {
    setEnviando(true);
    setError(null);
    try {
      const r = await actualizarPassword(formData);
      if (r?.error) setError(r.error);
    } catch (err) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form action={manejarSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Nueva contraseña
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Confirmar contraseña
        </label>
        <input
          name="confirmacion"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repetí tu nueva contraseña"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando ? "Guardando..." : "Guardar nueva contraseña"}
      </button>
    </form>
  );
}
