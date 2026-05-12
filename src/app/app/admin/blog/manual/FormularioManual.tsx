"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FormularioManual({
  categorias,
}: {
  categorias: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [resumen, setResumen] = useState("");
  const [contenido, setContenido] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (titulo.trim().length < 5) return setError("Título muy corto");
    if (resumen.trim().length < 30) return setError("Resumen muy corto");
    if (contenido.trim().length < 100) return setError("Contenido muy corto");

    startTransition(async () => {
      const r = await fetch("/api/admin/blog/articulos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          resumen: resumen.trim(),
          contenido_md: contenido,
          categoria_id: categoriaId || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setError(j?.error || `HTTP ${r.status}`);
        return;
      }
      const j = await r.json();
      router.push(`/app/admin/blog/${j.articulo.id}`);
    });
  }

  const inputClase =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white dark:placeholder:text-white/30";

  return (
    <form onSubmit={enviar} className="space-y-5">
      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título *"
        required
        className={`${inputClase} font-display text-2xl italic`}
      />
      <textarea
        value={resumen}
        onChange={(e) => setResumen(e.target.value)}
        rows={3}
        placeholder="Resumen / excerpt para listados (30-500) *"
        required
        className={inputClase}
      />
      <select
        value={categoriaId}
        onChange={(e) => setCategoriaId(e.target.value)}
        className={inputClase}
      >
        <option value="">— sin categoría —</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={24}
        placeholder="Contenido en Markdown…"
        required
        className={`${inputClase} font-mono`}
      />

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-emerald-600 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "guardando…" : "crear borrador"}
      </button>
    </form>
  );
}
