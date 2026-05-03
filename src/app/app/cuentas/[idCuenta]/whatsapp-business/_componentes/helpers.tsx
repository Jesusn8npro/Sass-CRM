"use client";

import { useState } from "react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  isSecret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  isSecret?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <input
        type={isSecret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
      />
      {hint && <p className="mt-1 text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function RowDato({
  label,
  valor,
  ok,
  copiable,
}: {
  label: string;
  valor: string | null;
  ok: boolean;
  copiable?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    if (!valor) return;
    await navigator.clipboard.writeText(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-800">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-xs">
          {valor || "—"}
        </span>
        {copiable && valor && (
          <button
            type="button"
            onClick={copiar}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            title="Copiar"
          >
            {copiado ? "✓" : "⎘"}
          </button>
        )}
        {ok && <span className="text-emerald-500">✓</span>}
      </div>
    </div>
  );
}
