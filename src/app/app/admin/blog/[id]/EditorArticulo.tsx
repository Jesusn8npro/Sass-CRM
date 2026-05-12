"use client";

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
        setFeedback("guardado ✓");
        router.refresh();
      }
    });
  }

  function publicar() {
    if (!confirm("¿Publicar este artículo? Quedará visible en /blog.")) return;
    startTransition(async () => {
      const ok = await llamarApi({ accion: "publicar" });
      if (ok) {
        setFeedback("publicado ✓");
        router.refresh();
      }
    });
  }

  function archivar() {
    if (!confirm("¿Archivar? Se sacará del index público.")) return;
    startTransition(async () => {
      const ok = await llamarApi({ accion: "archivar" });
      if (ok) {
        setFeedback("archivado ✓");
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
      router.push("/app/admin/blog");
    });
  }

  const inputClase =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white dark:placeholder:text-white/30";
  const botonAccion =
    "rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
            // blog · editor
          </p>
          <h1 className="font-display mt-1 text-3xl italic leading-tight text-zinc-900 dark:text-white">
            {articulo.estado === "publicado" ? "Publicado" : articulo.estado === "borrador" ? "Borrador" : "Archivado"}
          </h1>
          <p className="font-mono text-[10px] text-zinc-400 dark:text-white/35">
            /{articulo.slug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/blog/${articulo.slug}`}
            target="_blank"
            rel="noreferrer"
            className={`${botonAccion} border border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-white/15 dark:text-white/70 dark:hover:border-white/30`}
          >
            👁 preview
          </a>
          <button
            onClick={guardar}
            disabled={pending}
            className={`${botonAccion} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            guardar
          </button>
          {articulo.estado === "borrador" && (
            <button
              onClick={publicar}
              disabled={pending}
              className={`${botonAccion} bg-blue-600 text-white hover:bg-blue-700`}
            >
              📢 publicar
            </button>
          )}
          {articulo.estado === "publicado" && (
            <button
              onClick={archivar}
              disabled={pending}
              className={`${botonAccion} bg-amber-500 text-white hover:bg-amber-600`}
            >
              📦 archivar
            </button>
          )}
          <button
            onClick={eliminar}
            disabled={pending}
            className={`${botonAccion} bg-red-600 text-white hover:bg-red-700`}
          >
            🗑 eliminar
          </button>
        </div>
      </header>

      {feedback && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-mono text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Contenido (col 2) */}
        <div className="space-y-4 lg:col-span-2">
          <input
            type="text"
            value={estado.titulo}
            onChange={(e) => actualizar("titulo", e.target.value)}
            placeholder="Título"
            className={`${inputClase} font-display text-2xl italic`}
          />
          <textarea
            value={estado.resumen}
            onChange={(e) => actualizar("resumen", e.target.value)}
            rows={3}
            placeholder="Resumen / excerpt (30-500 chars)"
            className={inputClase}
          />
          <textarea
            value={estado.contenido_md}
            onChange={(e) => actualizar("contenido_md", e.target.value)}
            rows={28}
            placeholder="Contenido en Markdown…"
            className={`${inputClase} font-mono`}
          />
        </div>

        {/* Sidebar (col 1) */}
        <aside className="space-y-4 text-sm">
          <Campo etiqueta="// categoría">
            <select
              value={estado.categoria_id}
              onChange={(e) => actualizar("categoria_id", e.target.value)}
              className={inputClase}
            >
              <option value="">sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="// imagen portada (url)">
            <input
              type="url"
              value={estado.imagen_portada_url}
              onChange={(e) => actualizar("imagen_portada_url", e.target.value)}
              placeholder="https://…"
              className={inputClase}
            />
            {estado.imagen_portada_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={estado.imagen_portada_url}
                alt=""
                className="mt-2 aspect-video w-full rounded-lg object-cover"
              />
            )}
          </Campo>

          <Campo etiqueta="// alt portada">
            <input
              type="text"
              value={estado.imagen_portada_alt}
              onChange={(e) => actualizar("imagen_portada_alt", e.target.value)}
              className={inputClase}
            />
          </Campo>

          <hr className="border-zinc-200 dark:border-white/[0.06]" />

          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
            // seo
          </p>

          <Campo etiqueta={`// seo título (${estado.seo_titulo.length}/65)`}>
            <input
              type="text"
              value={estado.seo_titulo}
              onChange={(e) => actualizar("seo_titulo", e.target.value)}
              maxLength={65}
              className={inputClase}
            />
          </Campo>

          <Campo etiqueta={`// descripción (${estado.seo_descripcion.length}/160)`}>
            <textarea
              value={estado.seo_descripcion}
              onChange={(e) => actualizar("seo_descripcion", e.target.value)}
              maxLength={160}
              rows={3}
              className={inputClase}
            />
          </Campo>

          <Campo etiqueta="// keywords (separadas con coma)">
            <input
              type="text"
              value={estado.seo_keywords}
              onChange={(e) => actualizar("seo_keywords", e.target.value)}
              placeholder="whatsapp, ia, marketing"
              className={inputClase}
            />
          </Campo>
        </aside>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
        {etiqueta}
      </p>
      {children}
    </div>
  );
}
