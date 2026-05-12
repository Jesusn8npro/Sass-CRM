"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CuentaResumen {
  id: string;
  etiqueta: string;
  telefono: string | null;
  estado: string;
  usuario_email: string;
}

export function Selector({
  cuentas,
  cuentaActualId,
}: {
  cuentas: CuentaResumen[];
  cuentaActualId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [seleccion, setSeleccion] = useState<string>(cuentaActualId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  function marcar() {
    if (!seleccion) {
      setError("Elegí una cuenta primero");
      return;
    }
    setError(null);
    setExito(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/agente-admin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cuenta_id: seleccion }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setError(j?.error || `HTTP ${r.status}`);
          return;
        }
        setExito("Cuenta marcada como canal admin");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function desmarcar() {
    setError(null);
    setExito(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/agente-admin", { method: "DELETE" });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setError(j?.error || `HTTP ${r.status}`);
          return;
        }
        setSeleccion("");
        setExito("Canal admin desactivado");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-4">
      <select
        value={seleccion}
        onChange={(e) => setSeleccion(e.target.value)}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white"
        disabled={pending}
      >
        <option value="">— elegí una cuenta —</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.etiqueta} ·{" "}
            {c.telefono ? `+${c.telefono}` : "sin tel"} ·{" "}
            {c.usuario_email} · {c.estado}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={marcar}
          disabled={pending || !seleccion || seleccion === cuentaActualId}
          className="rounded-full bg-emerald-600 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "guardando…" : "marcar como canal admin"}
        </button>
        {cuentaActualId && (
          <button
            type="button"
            onClick={desmarcar}
            disabled={pending}
            className="rounded-full border border-zinc-300 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.12] dark:text-white/70 dark:hover:bg-white/[0.04]"
          >
            {pending ? "guardando…" : "quitar canal admin"}
          </button>
        )}
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

      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
        solo UNA cuenta puede ser canal admin a la vez. al marcar una nueva,
        la anterior se desmarca automáticamente.
      </p>
    </div>
  );
}
