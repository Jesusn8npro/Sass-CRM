"use client";

/**
 * Formulario CLIENTE para disparar la generación IA de un artículo
 * de blog. Tras éxito redirige al editor del borrador creado.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Categoria {
  id: string;
  slug: string;
  nombre: string;
}

export function FormularioGenerar({
  categorias,
}: {
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tema, setTema] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [longitud, setLongitud] = useState<"corto" | "medio" | "largo">("medio");
  const [generarImagen, setGenerarImagen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tema.trim().length < 5) {
      setError("El tema es muy corto");
      return;
    }
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/blog/generar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tema: tema.trim(),
            categoria: categoria || undefined,
            longitud,
            generar_imagen: generarImagen,
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setError(j?.error || `HTTP ${r.status}`);
          return;
        }
        const j = await r.json();
        if (!j.articulo?.id) {
          setError("Respuesta inesperada del servidor");
          return;
        }
        router.push(`/admin/blog/${j.articulo.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-5 max-w-2xl">
      <div>
        <label className="block text-sm font-medium mb-1">
          Tema del artículo *
        </label>
        <textarea
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          rows={3}
          required
          placeholder="Ej: Cómo usar WhatsApp Business API para automatizar atención al cliente en un e-commerce de moda"
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-sm"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Cuanto más específico el tema, mejor el resultado. Mencioná
          contexto/audiencia si querés.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-sm"
          >
            <option value="">— Sin categoría —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Longitud</label>
          <select
            value={longitud}
            onChange={(e) => setLongitud(e.target.value as typeof longitud)}
            className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-sm"
          >
            <option value="corto">Corto (~1200 palabras)</option>
            <option value="medio">Medio (~2000 palabras)</option>
            <option value="largo">Largo (~3000 palabras)</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={generarImagen}
          onChange={(e) => setGenerarImagen(e.target.checked)}
          className="w-4 h-4"
        />
        Generar imagen de portada con IA (~30s extra)
      </label>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "✨ Generando... (1-2 min)" : "✨ Generar artículo"}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        El artículo se crea como <strong>borrador</strong> — vos lo revisás y
        publicás manualmente desde el editor.
      </p>
    </form>
  );
}
