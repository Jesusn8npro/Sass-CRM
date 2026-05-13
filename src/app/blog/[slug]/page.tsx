import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  listarSlugsPublicados,
  obtenerArticuloPorSlug,
  incrementarVisualizaciones,
} from "@/lib/baseDatos";
import {
  RenderMarkdown,
  TablaContenidos,
  extraerTabla,
} from "@/lib/blog/markdown";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

// Revalida cada 5 min — más conservador que el index porque la URL
// específica es estable.
export const revalidate = 300;
export const dynamicParams = true; // permitir slugs nuevos sin rebuild total

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * SSG: genera el HTML para todos los slugs publicados al build.
 * Los nuevos artículos se renderizan on-demand (dynamicParams=true).
 */
export async function generateStaticParams() {
  try {
    const slugs = await listarSlugsPublicados();
    return slugs.map((s) => ({ slug: s.slug }));
  } catch (err) {
    // Si la DB no está disponible al build (dev local sin migraciones,
    // por ejemplo), no rompemos — devolvemos lista vacía.
    console.warn("[blog/[slug]] no se pudieron listar slugs:", err);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await obtenerArticuloPorSlug(slug);
  if (!a) {
    return {
      title: "Artículo no encontrado",
      robots: { index: false },
    };
  }
  const urlCanonica = urlAbsoluta(`/blog/${a.slug}`);
  const tituloSEO = a.seo_titulo || a.titulo;
  const descSEO = a.seo_descripcion || a.resumen;
  return {
    title: `${tituloSEO} · Sass-CRM`,
    description: descSEO,
    keywords: a.seo_keywords,
    authors: [{ name: a.autor_nombre }],
    alternates: { canonical: urlCanonica },
    openGraph: {
      title: tituloSEO,
      description: descSEO,
      url: urlCanonica,
      type: "article",
      locale: "es",
      publishedTime: a.publicado_en ?? undefined,
      modifiedTime: a.actualizado_en,
      images: a.imagen_portada_url
        ? [
            {
              url: a.imagen_portada_url,
              alt: a.imagen_portada_alt ?? a.titulo,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: tituloSEO,
      description: descSEO,
      images: a.imagen_portada_url ? [a.imagen_portada_url] : undefined,
    },
  };
}

export default async function PaginaArticulo({ params }: Props) {
  const { slug } = await params;
  const articulo = await obtenerArticuloPorSlug(slug);
  if (!articulo) notFound();

  // Incrementar visualizaciones en background — no bloqueamos el render
  void incrementarVisualizaciones(articulo.id);

  // JSON-LD Schema.org BlogPosting (lo lee Google para rich snippets)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: articulo.titulo,
    description: articulo.resumen,
    image: articulo.imagen_portada_url ?? undefined,
    datePublished: articulo.publicado_en ?? articulo.creado_en,
    dateModified: articulo.actualizado_en,
    author: {
      "@type": "Person",
      name: articulo.autor_nombre,
    },
    publisher: {
      "@type": "Organization",
      name: "Sass-CRM",
      url: urlAbsoluta("/"),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": urlAbsoluta(`/blog/${articulo.slug}`),
    },
    keywords: articulo.seo_keywords.join(", "),
    wordCount: articulo.contenido_md.split(/\s+/).length,
  };

  return (
    <article className="min-h-screen bg-white dark:bg-zinc-950">
      {/* JSON-LD para Google Search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 pb-8">
        <Link
          href="/blog"
          className="text-sm text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
        >
          ← Volver al blog
        </Link>
        {articulo.categoria_slug && articulo.categoria_nombre && (
          <Link
            href={`/blog/categoria/${articulo.categoria_slug}`}
            className="inline-block mt-4 text-xs uppercase tracking-widest text-emerald-600 font-medium"
          >
            {articulo.categoria_nombre}
          </Link>
        )}
        <h1 className="mt-3 text-4xl sm:text-5xl font-bold leading-tight">
          {articulo.titulo}
        </h1>
        <p className="mt-4 text-xl text-zinc-600 dark:text-zinc-400">
          {articulo.resumen}
        </p>
        <div className="mt-6 flex items-center gap-4 text-sm text-zinc-500">
          <span>{articulo.autor_nombre}</span>
          <span>•</span>
          <time dateTime={articulo.publicado_en ?? articulo.creado_en}>
            {new Date(
              articulo.publicado_en ?? articulo.creado_en,
            ).toLocaleDateString("es", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          <span>•</span>
          <span>{articulo.tiempo_lectura_min} min de lectura</span>
        </div>
      </header>

      {/* Imagen portada (LCP del artículo — priority + sizes responsive) */}
      {articulo.imagen_portada_url && (
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={articulo.imagen_portada_url}
              alt={articulo.imagen_portada_alt ?? articulo.titulo}
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 896px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        {/* Tabla de contenidos — solo si hay >=2 headings H2/H3 */}
        <TablaContenidos items={extraerTabla(articulo.contenido_md)} />

        <div className="text-zinc-800 dark:text-zinc-200">
          <RenderMarkdown md={articulo.contenido_md} />
        </div>

        {/* Footer CTA */}
        <div className="mt-16 p-6 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
          <h3 className="text-xl font-bold">¿Querés probar Sass-CRM gratis?</h3>
          <p className="mt-2 text-emerald-50">
            Conectá tu WhatsApp en 60 segundos y empezá a vender con IA.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-white text-emerald-700 font-semibold hover:bg-emerald-50 transition"
          >
            Crear cuenta gratis →
          </Link>
        </div>
      </div>
    </article>
  );
}
