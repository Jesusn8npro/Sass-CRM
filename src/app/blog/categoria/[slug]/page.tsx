import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  listarArticulosPublicados,
  listarCategorias,
  obtenerCategoriaPorSlug,
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
  const categoria = await obtenerCategoriaPorSlug(slug);
  if (!categoria) notFound();

  const articulos = await listarArticulosPublicados({
    categoriaSlug: slug,
    limite: 50,
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <Link
          href="/blog"
          className="text-sm text-emerald-600 hover:text-emerald-700"
        >
          ← Todas las categorías
        </Link>
        <header className="mt-6 mb-10">
          <p className="text-sm uppercase tracking-widest text-emerald-600 font-medium">
            Categoría
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold mt-2">
            {categoria.nombre}
          </h1>
          {categoria.descripcion && (
            <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-lg max-w-2xl">
              {categoria.descripcion}
            </p>
          )}
          <p className="mt-2 text-sm text-zinc-500">
            {articulos.length} {articulos.length === 1 ? "artículo" : "artículos"}
          </p>
        </header>

        {articulos.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            Todavía no hay artículos en esta categoría.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {articulos.map((a, i) => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                style={{
                  contentVisibility: "auto",
                  containIntrinsicSize: "0 380px",
                }}
                className="group rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-emerald-500 transition flex flex-col"
              >
                {a.imagen_portada_url ? (
                  <div className="relative w-full aspect-video bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={a.imagen_portada_url}
                      alt={a.imagen_portada_alt ?? a.titulo}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 480px"
                      loading={i < 2 ? "eager" : "lazy"}
                      priority={i < 2}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-3xl font-bold">
                    {a.titulo[0]?.toUpperCase()}
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="text-xl font-bold group-hover:text-emerald-600 transition">
                    {a.titulo}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 flex-1">
                    {a.resumen}
                  </p>
                  <div className="mt-4 text-xs text-zinc-500">
                    {a.tiempo_lectura_min} min · {a.autor_nombre}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
