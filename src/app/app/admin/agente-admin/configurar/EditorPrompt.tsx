"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function EditorPrompt({
  promptCustomInicial,
  promptDefault,
}: {
  promptCustomInicial: string;
  promptDefault: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [valor, setValor] = useState(
    promptCustomInicial.length > 0 ? promptCustomInicial : promptDefault,
  );
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [mostrandoDefault, setMostrandoDefault] = useState(false);

  const esActualmenteDefault = valor.trim() === promptDefault.trim();

  function guardar() {
    setError(null);
    setExito(null);
    startTransition(async () => {
      try {
        // Si el valor coincide exactamente con el default, mandamos vacío
        // para "resetear" y caer al default hardcoded del código.
        const promptParaGuardar = esActualmenteDefault ? "" : valor;
        const r = await fetch("/api/admin/agente-admin/prompt", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: promptParaGuardar }),
        });
        const j = await r.json();
        if (!r.ok) {
          setError(j?.error || `HTTP ${r.status}`);
          return;
        }
        setExito(
          j.es_default
            ? "Prompt reseteado al default del sistema"
            : "Prompt custom guardado",
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function resetearADefault() {
    setValor(promptDefault);
    setError(null);
    setExito("Prompt cargado al default — clickeá guardar para aplicar");
  }

  function cargarCustomGuardado() {
    setValor(
      promptCustomInicial.length > 0 ? promptCustomInicial : promptDefault,
    );
    setExito(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // editor del prompt
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMostrandoDefault(!mostrandoDefault)}
            className="rounded-full border border-zinc-300 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-white/[0.12] dark:text-white/70 dark:hover:bg-white/[0.04]"
          >
            {mostrandoDefault ? "ocultar default" : "ver default"}
          </button>
          <button
            type="button"
            onClick={resetearADefault}
            disabled={pending}
            className="rounded-full border border-zinc-300 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/[0.12] dark:text-white/70 dark:hover:bg-white/[0.04]"
          >
            cargar default
          </button>
          {promptCustomInicial.length > 0 && (
            <button
              type="button"
              onClick={cargarCustomGuardado}
              disabled={pending}
              className="rounded-full border border-zinc-300 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/[0.12] dark:text-white/70 dark:hover:bg-white/[0.04]"
            >
              cargar guardado
            </button>
          )}
        </div>
      </div>

      {mostrandoDefault && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
            prompt default del sistema (referencia)
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-700 dark:text-white/70">
            {promptDefault}
          </pre>
        </div>
      )}

      <textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        rows={22}
        disabled={pending}
        spellCheck={false}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed text-zinc-900 focus:border-emerald-500 focus:outline-none disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
          {valor.length.toLocaleString("es-AR")} caracteres
          {esActualmenteDefault && " · (igual al default)"}
        </p>
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-full bg-emerald-600 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "guardando…" : "💾 guardar prompt"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}
      {exito && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-mono text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          ✓ {exito}
        </div>
      )}
    </div>
  );
}
