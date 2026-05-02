"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Form simple para crear la primera cuenta WhatsApp del usuario.
 * Después de crear redirige a /app/cuentas/[id]/whatsapp para
 * escanear el QR.
 */
export function CrearPrimeraCuenta() {
  const router = useRouter();
  const [etiqueta, setEtiqueta] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!etiqueta.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch("/api/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: etiqueta.trim() }),
      });
      const data = (await res.json()) as
        | { cuenta: { id: string } }
        | { error: string };
      if (!res.ok || !("cuenta" in data)) {
        setError(("error" in data && data.error) || "Error creando");
        return;
      }
      router.push(`/app/cuentas/${data.cuenta.id}/whatsapp`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 text-4xl">📱</div>
      <p className="font-semibold">No tenés ninguna cuenta de WhatsApp todavía</p>
      <p className="mt-1 mb-6 text-sm text-zinc-500">
        Creá tu primera cuenta y conectala con el QR. Plan Gratis incluye 1 cuenta.
      </p>
      <form
        onSubmit={crear}
        className="mx-auto flex max-w-sm flex-col gap-3"
      >
        <input
          type="text"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          placeholder="Nombre del negocio (ej: Mi Joyería)"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={!etiqueta.trim() || creando}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50"
        >
          {creando ? "Creando…" : "Crear cuenta y conectar WhatsApp"}
        </button>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
