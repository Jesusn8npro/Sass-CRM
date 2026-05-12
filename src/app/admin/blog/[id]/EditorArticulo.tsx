"use client";

/**
 * Editor cliente del artículo (CRUD + publicar/archivar/eliminar).
 *
 * Diseño minimalista: textarea para markdown, inputs para metadata SEO,
 * select para categoría, y 4 botones grandes para acciones.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Articulo {
  id: string;
  slug: string;
  titulo: string;
  resumen: string;
  contenido_md: string;
  imagen_portada_url: string | null;
  imagen_portada_alt: string | null;
  categoria_id: string | null;
  estado: "borrador" | "publicado" | "archivado";
  seo_titulo: string | null;
  seo_descripcion: string | null;
  seo_keywords: string[];
}

interface Categoria {
  id: string;
  nombre: string;
}

export function EditorArticulo({
  articulo,
  categorias,
}: {
  articulo: Articulo;
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState({
    titulo: articulo.titulo,
    resumen: articulo.resumen,
    contenido_md: articulo.contenido_md,
    imagen_portada_url: articulo.imagen_portada_url ?? "",
    imagen_portada_alt: articulo.imagen_portada_alt ?? "",
    categoria_id: articulo.categoria_id ?? "",
    seo_titulo: articulo.seo_titulo ?? "",
    seo_descripcion: articulo.seo_descripcion ?? "",
    seo_keywords: articulo.seo_keywords.join(", "),
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function actualizar<K extends keyof typeof estado>(k: K, v: string) {
    setEstado((s) => ({ ...s, [k]: v }));
  }

  async function llamarApi(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setFeedback(null);
    const r = await fetch(`/api/admin/blog/articulos/${articulo.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.error || `HTTP ${r.status}`);
      return false;
    }
    return true;
  }

  function guardar() {
    startTransition(async () => {
      const ok = await llamarApi({
        titulo: estado.titulo,
        resumen: estado.resumen,
        contenido_md: estado.contenido_md,
        imagen_portada_url: estado.imagen_portada_url || null,
        imagen_portada_alt: estado.imagen_portada_alt || null,
        categoria_id: estado.categoria_id || null,
        seo_titulo: estado.seo_titulo || null,
        seo_descripcion: estado.seo_descripcion || null,
        seo_keywords: estado.seo_keywords
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
      });
      if (ok) {
        setFeedback("Guardado ✓");
        router.refresh();
      }
    });
  }

  function publicar() {
    if (!confirm("¿Publicar este artículo? Quedará visible en /blog.")) return;
    startTransition(async () => {
      const ok = await llamarApi({ accion: "publicar" });
      if (ok) {
        setFeedback("Publicado ✓");
        router.refresh();
      }
    });
  }

  function archivar() {
    if (!confirm("¿Archivar? Se sacará del index público.")) return;
    startTransition(async () => {
      const ok = await llamarApi({ accion: "archivar" });
      if (ok) {
        setFeedback("Archivado ✓");
        router.refresh();
      }
    });
  }

  async function eliminar() {
    if (!confirm("¿Eliminar definitivamente? No se puede deshacer.")) return;
    startTransition(async () => {
      const r = await fetch(`/api/admin/blog/articulos/${articulo.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setError(j?.error || `HTTP ${r.status}`);
        return;
      }
      router.push("/admin/blog");
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500 font-mono">/{articulo.slug}</p>
          <h2 className="text-xl font-bold">Editor</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/blog/${articulo.slug}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-sm rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300"
          >
            👁 Preview
          </a>
          <button
            onClick={guardar}
            disabled={pending}
            className="px-4 py-1.5 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            Guardar cambios
          </button>
          {articulo.estado === "borrador" && (
            <button
              onClick={publicar}
              disabled={pending}
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              📢 Publicar
            </button>
          )}
          {articulo.estado === "publicado" && (
            <button
              onClick={archivar}
              disabled={pending}
              className="px-4 py-1.5 text-sm rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
            >
              📦 Archivar
            </button>
          )}
          <button
            onClick={eliminar}
            disabled={pending}
            className="px-4 py-1.5 text-sm rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
          >
            🗑 Eliminar
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 text-sm">
          {feedback}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenido (col 2) */}
        <div className="lg:col-span-2 space-y-4">
          <input
            type="text"
            value={estado.titulo}
            onChange={(e) => actualizar("titulo", e.target.value)}
            placeholder="Título"
            className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 text-2xl font-bold"
          />
          <textarea
            value={estado.resumen}
            onChange={(e) => actualizar("resumen", e.target.value)}
            rows={3}
            placeholder="Resumen / excerpt (30-500 chars)"
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 text-sm"
          />
          <textarea
            value={estado.contenido_md}
            onChange={(e) => actualizar("contenido_md", e.target.value)}
            rows={28}
            placeholder="Contenido en Markdown..."
            className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300 font-mono text-sm"
          />
        </div>

        {/* Sidebar (col 1) */}
        <div className="space-y-4 text-sm">
          <div>
            <label className="block font-medium mb-1">Categoría</label>
            <select
              value={estado.categoria_id}
              onChange={(e) => actualizar("categoria_id", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">Imagen portada URL</label>
            <input
              type="url"
              value={estado.imagen_portada_url}
              onChange={(e) => actualizar("imagen_portada_url", e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300"
            />
            {estado.imagen_portada_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={estado.imagen_portada_url}
                alt=""
                className="mt-2 w-full aspect-video object-cover rounded-lg"
              />
            )}
          </div>

          <div>
            <label className="block font-medium mb-1">Alt de portada</label>
            <input
              type="text"
              value={estado.imagen_portada_alt}
              onChange={(e) => actualizar("imagen_portada_alt", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300"
            />
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          <h3 className="font-semibold">SEO</h3>

          <div>
            <label className="block font-medium mb-1">
              SEO título ({estado.seo_titulo.length}/65)
            </label>
            <input
              type="text"
              value={estado.seo_titulo}
              onChange={(e) => actualizar("seo_titulo", e.target.value)}
              maxLength={65}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              SEO descripción ({estado.seo_descripcion.length}/160)
            </label>
            <textarea
              value={estado.seo_descripcion}
              onChange={(e) => actualizar("seo_descripcion", e.target.value)}
              maxLength={160}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">
              Keywords (separadas con coma)
            </label>
            <input
              type="text"
              value={estado.seo_keywords}
              onChange={(e) => actualizar("seo_keywords", e.target.value)}
              placeholder="whatsapp, ia, marketing"
              className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-zinc-900 border-zinc-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
