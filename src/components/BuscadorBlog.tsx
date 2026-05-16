"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ArticuloConCategoria } from "@/lib/baseDatos";

interface Props {
  articulos: ArticuloConCategoria[];
  categorias: { id: string; slug: string; nombre: string }[];
}

export function BuscadorBlog({ articulos, categorias }: Props) {
  const [query, setQuery] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = query.toLowerCase().trim();
    return articulos.filter((a) => {
      const matchCat = !categoriaActiva || a.categoria_slug === categoriaActiva;
      if (!q) return matchCat;
      return (
        matchCat &&
        (a.titulo.toLowerCase().includes(q) ||
          (a.resumen ?? "").toLowerCase().includes(q) ||
          (a.autor_nombre ?? "").toLowerCase().includes(q) ||
          (a.categoria_nombre ?? "").toLowerCase().includes(q))
      );
    });
  }, [articulos, query, categoriaActiva]);

  const destacado = filtrados[0] ?? null;
  const resto = filtrados.slice(1);

  return (
    <div className="flex flex-col gap-8">
      {/* Barra de búsqueda */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar artículos…"
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2.5 pl-9 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>
        <span className="font-mono text-[10px] text-zinc-600 shrink-0">
          {filtrados.length} {filtrados.length === 1 ? "artículo" : "artículos"}
        </span>
      </div>

      {/* Filtros por categoría (móvil) */}
      {categorias.length > 0 && (
        <nav className="flex flex-wrap gap-2 lg:hidden">
          <button
            onClick={() => setCategoriaActiva(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!categoriaActiva ? "bg-emerald-500/15 border border-emerald-400/25 text-emerald-300" : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
          >
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaActiva(c.slug === categoriaActiva ? null : c.slug)}
              className={`rounded-full px-3 py-1 text-xs transition ${c.slug === categoriaActiva ? "bg-emerald-500/15 border border-emerald-400/25 text-emerald-300" : "border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-200"}`}
            >
              {c.nombre}
            </button>
          ))}
        </nav>
      )}

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-400">Sin resultados para <span className="text-zinc-200">"{query}"</span></p>
          <button onClick={() => { setQuery(""); setCategoriaActiva(null); }} className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition">
            Limpiar filtros →
          </button>
        </div>
      ) : (
        <>
          {/* Artículo destacado */}
          {destacado && <ArticuloDestacado articulo={destacado} />}
          {/* Grilla del resto */}
          {resto.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {resto.map((a, i) => <TarjetaArticulo key={a.id} articulo={a} prioridad={i < 2} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ArticuloDestacado({ articulo }: { articulo: ArticuloConCategoria }) {
  return (
    <Link href={`/blog/${articulo.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition-all hover:border-emerald-400/30 hover:bg-white/[0.04] sm:flex-row sm:h-64">
      <div className="relative h-48 w-full shrink-0 sm:h-auto sm:w-72">
        {articulo.imagen_portada_url ? (
          <Image src={articulo.imagen_portada_url} alt={articulo.imagen_portada_alt ?? articulo.titulo}
            fill priority sizes="(max-width: 640px) 100vw, 288px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600/30 to-emerald-900/40 text-5xl font-bold text-emerald-300/50">
            {articulo.titulo[0]?.toUpperCase() ?? "B"}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-950/60 sm:to-zinc-950/80" />
      </div>
      <div className="flex flex-col justify-center p-6">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-400">{articulo.categoria_nombre ?? "Destacado"}</p>
        <h2 className="mt-2 text-xl font-bold leading-snug text-zinc-100 transition group-hover:text-emerald-200 md:text-2xl">{articulo.titulo}</h2>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{articulo.resumen}</p>
        <div className="mt-4 flex items-center gap-3 text-xs text-zinc-600">
          <span>{articulo.autor_nombre}</span><span>·</span><span>{articulo.tiempo_lectura_min} min de lectura</span>
        </div>
      </div>
    </Link>
  );
}

function TarjetaArticulo({ articulo, prioridad }: { articulo: ArticuloConCategoria; prioridad?: boolean }) {
  return (
    <Link href={`/blog/${articulo.slug}`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 320px" }}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition-all hover:border-emerald-400/30 hover:bg-white/[0.04]">
      <div className="relative aspect-video w-full">
        {articulo.imagen_portada_url ? (
          <Image src={articulo.imagen_portada_url} alt={articulo.imagen_portada_alt ?? articulo.titulo}
            fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 380px"
            loading={prioridad ? "eager" : "lazy"} priority={prioridad}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600/20 to-zinc-900 text-3xl font-bold text-emerald-300/40">
            {articulo.titulo[0]?.toUpperCase() ?? "B"}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {articulo.categoria_nombre && <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400">{articulo.categoria_nombre}</p>}
        <h2 className="mt-1.5 text-sm font-semibold leading-snug text-zinc-100 transition group-hover:text-emerald-200">{articulo.titulo}</h2>
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-zinc-500">{articulo.resumen}</p>
        <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
          <span>{articulo.autor_nombre}</span><span>{articulo.tiempo_lectura_min} min</span>
        </div>
      </div>
    </Link>
  );
}
