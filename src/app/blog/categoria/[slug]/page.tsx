import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  listarArticulosPublicados,
  listarCategorias,
  obtenerCategoriaPorSlug,
  type ArticuloConCategoria,
} from "@/lib/baseDatos";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const revalidate = 300;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const categorias = await listarCategorias();
    return categorias.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await obtenerCategoriaPorSlug(slug);
  if (!cat) return { title: "Categoría no encontrada", robots: { index: false } };
  const url = urlAbsoluta(`/blog/categoria/${cat.slug}`);
  return {
    title: `${cat.nombre} · Blog Sass-CRM`,
    description: cat.descripcion ?? `Artículos sobre ${cat.nombre.toLowerCase()}.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${cat.nombre} · Blog Sass-CRM`,
      description: cat.descripcion ?? undefined,
      url,
      type: "website",
      locale: "es",
    },
  };
}

export default async function PaginaCategoria({ params }: Props) {
  const { slug } = await params;
  const [categoria, categorias] = await Promise.all([
    obtenerCategoriaPorSlug(slug),
    listarCategorias(),
  ]);
  if (!categoria) notFound();

  const articulos = await listarArticulosPublicados({ categoriaSlug: slug, limite: 50 });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Orb ambiental */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-[500px] w-[500px] opacity-25"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "mesh-drift-1 20s ease-in-out infinite",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-10 lg:py-14">
        {/* Header */}
        <header className="mb-10 border-b border-white/[0.06] pb-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400 transition hover:text-emerald-300"
          >
            ← Todas las categorías
          </Link>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            <span className="font-display italic text-emerald-300">{categoria.nombre}</span>
          </h1>
          {categoria.descripcion && (
            <p className="mt-3 max-w-xl text-sm text-zinc-400">{categoria.descripcion}</p>
          )}
          <p className="mt-2 font-mono text-xs text-zinc-600">
            {articulos.length} {articulos.length === 1 ? "artículo" : "artículos"}
          </p>
        </header>

        {/* Layout 3 columnas */}
        <div className="flex gap-8">
          {/* ── Sidebar izquierdo ── */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-20 flex flex-col gap-5">
              <div>
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">
                  Categorías
                </p>
                <nav className="flex flex-col gap-1">
                  <Link
                    href="/blog"
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100"
                  >
                    Todos los artículos
                  </Link>
                  {categorias.map((c) => (
                    <Link
                      key={c.id}
                      href={`/blog/categoria/${c.slug}`}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        c.slug === slug
                          ? "bg-emerald-400/10 border border-emerald-400/20 font-medium text-emerald-400"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                      }`}
                    >
                      {c.nombre}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* ── Grilla de artículos ── */}
          <main className="min-w-0 flex-1">
            {articulos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-zinc-400">Todavía no hay artículos en esta categoría.</p>
                <Link href="/blog" className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition">
                  Ver todos los artículos →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {articulos.map((a, i) => (
                  <TarjetaArticulo key={a.id} articulo={a} prioridad={i < 2} />
                ))}
              </div>
            )}
          </main>

          {/* ── Sidebar derecho ── */}
          <aside className="hidden w-52 shrink-0 xl:block">
            <div className="sticky top-20 flex flex-col gap-5">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-emerald-400">
                  Comenzá hoy
                </p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">
                  Automatizá tu WhatsApp con IA en 30 minutos.
                </p>
                <Link
                  href="/signup"
                  className="mt-4 block rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-xs font-bold text-black transition hover:bg-emerald-400"
                >
                  Crear cuenta gratis
                </Link>
                <p className="mt-2 text-center font-mono text-[9px] text-zinc-600">
                  Sin tarjeta · Setup ≤ 2 min
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">
                  Esta categoría
                </p>
                <p className="text-xl font-bold text-emerald-300">{articulos.length}</p>
                <p className="text-xs text-zinc-500">
                  {articulos.length === 1 ? "artículo publicado" : "artículos publicados"}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TarjetaArticulo({
  articulo,
  prioridad,
}: {
  articulo: ArticuloConCategoria;
  prioridad?: boolean;
}) {
  return (
    <Link
      href={`/blog/${articulo.slug}`}
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 320px" }}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition-all hover:border-emerald-400/30 hover:bg-white/[0.04]"
    >
      <div className="relative aspect-video w-full">
        {articulo.imagen_portada_url ? (
          <Image
            src={articulo.imagen_portada_url}
            alt={articulo.imagen_portada_alt ?? articulo.titulo}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 380px"
            loading={prioridad ? "eager" : "lazy"}
            priority={prioridad}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600/20 to-zinc-900 text-3xl font-bold text-emerald-300/40">
            {articulo.titulo[0]?.toUpperCase() ?? "B"}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="text-sm font-semibold leading-snug text-zinc-100 transition group-hover:text-emerald-200">
          {articulo.titulo}
        </h2>
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-zinc-500">{articulo.resumen}</p>
        <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600">
          <span>{articulo.autor_nombre}</span>
          <span>{articulo.tiempo_lectura_min} min</span>
        </div>
      </div>
    </Link>
  );
}
