import Link from "next/link";
import type { Metadata } from "next";
import {
  listarArticulosPublicados,
  listarCategorias,
  type ArticuloConCategoria,
} from "@/lib/baseDatos";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

// Revalidación incremental cada 60s — balance entre frescura y costo
// del fetch. La página es estática casi todo el tiempo.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog · Sass-CRM",
  description:
    "Estrategias, IA aplicada y mejores prácticas en WhatsApp Business para PYMEs y emprendedores en Latinoamérica.",
  alternates: { canonical: urlAbsoluta("/blog") },
  openGraph: {
    title: "Blog · Sass-CRM",
    description: "Estrategias, IA y WhatsApp Business para PYMEs.",
    url: urlAbsoluta("/blog"),
    type: "website",
    locale: "es",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog · Sass-CRM",
    description: "Estrategias, IA y WhatsApp Business para PYMEs.",
  },
};

export default async function PaginaBlogIndice() {
  const [articulos, categorias] = await Promise.all([
    listarArticulosPublicados({ limite: 50 }),
    listarCategorias(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        {/* Header */}
        <header className="mb-10">
          <p className="text-sm uppercase tracking-widest text-emerald-600 font-medium">
            Blog
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold mt-2">
            Crece con IA, WhatsApp y datos
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-lg max-w-2xl">
            Guías prácticas, casos reales y novedades para PYMEs que quieren
            vender más con automatización conversacional.
          </p>
        </header>

        {/* Categorías */}
        {categorias.length > 0 && (
          <nav className="mb-10 flex flex-wrap gap-2">
            <Link
              href="/blog"
              className="px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-sm font-medium"
            >
              Todos
            </Link>
            {categorias.map((c) => (
              <Link
                key={c.id}
                href={`/blog/categoria/${c.slug}`}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm hover:border-emerald-500 transition"
              >
                {c.nombre}
              </Link>
            ))}
          </nav>
        )}

        {/* Listado */}
        {articulos.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p>Todavía no hay artículos publicados.</p>
            <p className="text-sm mt-2">¡Pronto llegarán los primeros!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {articulos.map((a) => (
              <TarjetaArticulo key={a.id} articulo={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaArticulo({ articulo }: { articulo: ArticuloConCategoria }) {
  return (
    <Link
      href={`/blog/${articulo.slug}`}
      className="group rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-emerald-500 transition flex flex-col"
    >
      {articulo.imagen_portada_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={articulo.imagen_portada_url}
          alt={articulo.imagen_portada_alt ?? articulo.titulo}
          className="w-full aspect-video object-cover bg-zinc-100 dark:bg-zinc-800"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-video bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-4xl font-bold">
          {articulo.titulo[0]?.toUpperCase() ?? "B"}
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        {articulo.categoria_nombre && (
          <p className="text-xs uppercase tracking-wider text-emerald-600 font-medium">
            {articulo.categoria_nombre}
          </p>
        )}
        <h2 className="mt-2 text-xl font-bold group-hover:text-emerald-600 transition">
          {articulo.titulo}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 flex-1">
          {articulo.resumen}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>{articulo.autor_nombre}</span>
          <span>{articulo.tiempo_lectura_min} min de lectura</span>
        </div>
      </div>
    </Link>
  );
}
