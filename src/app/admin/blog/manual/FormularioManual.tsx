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
      router.push(`/admin/blog/${j.articulo.id}`);
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4 max-w-3xl">
      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título *"
        required
        className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 text-xl font-bold"
      />
      <textarea
        value={resumen}
        onChange={(e) => setResumen(e.target.value)}
        rows={3}
        placeholder="Resumen / excerpt para listados *"
        required
        className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 text-sm"
      />
      <select
        value={categoriaId}
        onChange={(e) => setCategoriaId(e.target.value)}
        className="px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 text-sm"
      >
        <option value="">— Sin categoría —</option>
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
        placeholder="Contenido en Markdown..."
        required
        className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 font-mono text-sm"
      />

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Guardando..." : "Crear borrador"}
      </button>
    </form>
  );
}
