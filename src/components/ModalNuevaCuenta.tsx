"use client";

import { useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCreada: (cuenta: Cuenta) => void;
}

const PROMPT_PLACEHOLDER = `Eres un asistente virtual amable. Responde en español neutro,
en mensajes breves de 2 a 4 líneas. No uses emojis.
Si el usuario pide algo que no puedes resolver, responde:
"Déjame derivarte con un asesor humano."`;

export function ModalNuevaCuenta({ abierto, onCerrar, onCreada }: Props) {
  const [etiqueta, setEtiqueta] = useState("");
  const [promptSistema, setPromptSistema] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!etiqueta.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch("/api/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etiqueta: etiqueta.trim(),
          prompt_sistema: promptSistema.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          codigo?: string;
        };
        // 402 = límite de plan alcanzado. Marcamos para mostrar CTA upgrade.
        if (res.status === 402 || data.codigo === "limite_plan_alcanzado") {
          setError(
            (data.error ?? "Llegaste al límite de cuentas de tu plan.") +
              " Actualizá tu plan en Mi Cuenta.",
          );
        } else {
          setError(data.error ?? "Error creando la cuenta");
        }
        return;
      }
      const data = (await res.json()) as { cuenta: Cuenta };
      setEtiqueta("");
      setPromptSistema("");
      onCreada(data.cuenta);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nueva cuenta de WhatsApp
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Cada cuenta tiene su propio número, prompt y conversaciones.
          </p>
        </div>

        <form onSubmit={crear} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Nombre de la cuenta
            </label>
            <input
              type="text"
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Ej: Tienda Acordeones"
              autoFocus
              required
              maxLength={60}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Prompt del sistema (opcional)
            </label>
            <textarea
              value={promptSistema}
              onChange={(e) => setPromptSistema(e.target.value)}
              rows={6}
              placeholder={PROMPT_PLACEHOLDER}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 font-mono text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Si lo dejás vacío, se usa el prompt por defecto. Lo podés
              cambiar después en Ajustes.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={creando}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creando || !etiqueta.trim()}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creando ? "Creando..." : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
