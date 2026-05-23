import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  listarSlugsPublicados,
  obtenerArticuloPorSlug,
  incrementarVisualizaciones,
} from "@/lib/baseDatos";
import { RenderMarkdown, TablaContenidos, extraerTabla } from "@/lib/blog/markdown";
import { urlAbsoluta } from "@/lib/blog/siteUrl";
import { BarraProgresoLectura } from "@/components/BarraProgresoLectura";
import { FormularioSuscripcion } from "@/components/FormularioSuscripcion";

export const revalidate = 300;
export const dynamicParams = true;

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  try {
    const slugs = await listarSlugsPublicados();
    return slugs.map((s) => ({ slug: s.slug }));
  } catch (err) {
    console.warn("[blog/[slug]] no se pudieron listar slugs:", err);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await obtenerArticuloPorSlug(slug);
  if (!a) return { title: "Artículo no encontrado", robots: { index: false } };
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
      title: tituloSEO, description: descSEO, url: urlCanonica, type: "article",
      locale: "es", publishedTime: a.publicado_en ?? undefined, modifiedTime: a.actualizado_en,
      images: a.imagen_portada_url
        ? [{ url: a.imagen_portada_url, alt: a.imagen_portada_alt ?? a.titulo }]
        : [{ url: urlAbsoluta(`/og?titulo=${encodeURIComponent(tituloSEO)}&categoria=${encodeURIComponent(a.categoria_nombre ?? "")}&autor=${encodeURIComponent(a.autor_nombre)}&tiempo=${a.tiempo_lectura_min}`), width: 1200, height: 630, alt: tituloSEO }],
    },
    twitter: { card: "summary_large_image", title: tituloSEO, description: descSEO, images: a.imagen_portada_url ? [a.imagen_portada_url] : [urlAbsoluta(`/og?titulo=${encodeURIComponent(tituloSEO)}&categoria=${encodeURIComponent(a.categoria_nombre ?? "")}&autor=${encodeURIComponent(a.autor_nombre)}&tiempo=${a.tiempo_lectura_min}`)] },
  };
}

const CASOS_EXITO = [
  { empresa: "Joyería Luna", resultado: "+340% leads calificados", detalle: "Sector retail, Buenos Aires" },
  { empresa: "Clínica Odontológica Plus", resultado: "98% citas confirmadas", detalle: "Sector salud, Medellín" },
  { empresa: "Carnicería del Sur", resultado: "Cero mensajes sin responder", detalle: "Sector food, CDMX" },
];

export default async function PaginaArticulo({ params }: Props) {
  const { slug } = await params;
  const articulo = await obtenerArticuloPorSlug(slug);
  if (!articulo) notFound();

  void incrementarVisualizaciones(articulo.id);

  const articuloUrl = urlAbsoluta(`/blog/${articulo.slug}`);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: articulo.titulo, description: articulo.resumen, url: articuloUrl,
    image: articulo.imagen_portada_url ?? undefined, inLanguage: "es",
    datePublished: articulo.publicado_en ?? articulo.creado_en, dateModified: articulo.actualizado_en,
    author: { "@type": "Person", name: articulo.autor_nombre },
    publisher: { "@type": "Organization", name: "Sass-CRM", url: urlAbsoluta("/") },
    mainEntityOfPage: { "@type": "WebPage", "@id": articuloUrl },
    keywords: articulo.seo_keywords.join(", "),
    wordCount: articulo.contenido_md.split(/\s+/).length,
    articleSection: articulo.categoria_nombre ?? undefined,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: urlAbsoluta("/") },
      { "@type": "ListItem", position: 2, name: "Blog", item: urlAbsoluta("/blog") },
      ...(articulo.categoria_slug && articulo.categoria_nombre
        ? [{ "@type": "ListItem", position: 3, name: articulo.categoria_nombre, item: urlAbsoluta(`/blog/categoria/${articulo.categoria_slug}`) },
           { "@type": "ListItem", position: 4, name: articulo.titulo, item: articuloUrl }]
        : [{ "@type": "ListItem", position: 3, name: articulo.titulo, item: articuloUrl }]),
    ],
  };

  const tocItems = extraerTabla(articulo.contenido_md);
  const fechaFormateada = new Date(articulo.publicado_en ?? articulo.creado_en)
    .toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <BarraProgresoLectura />

      {/* Orb ambiental */}
      <div aria-hidden className="pointer-events-none fixed right-0 top-0 h-[500px] w-[500px] opacity-20"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.22) 0%, transparent 70%)", filter: "blur(80px)", animation: "mesh-drift-2 22s ease-in-out infinite" }} />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-10 lg:py-14">
        <div className="flex gap-8">

          {/* ── Sidebar izquierdo — navegación + casos de éxito ── */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-20 flex flex-col gap-5">
              <Link href="/blog"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs text-zinc-400 transition hover:border-emerald-400/30 hover:text-emerald-300">
                ← Volver al blog
              </Link>

              {articulo.categoria_slug && articulo.categoria_nombre && (
                <Link href={`/blog/categoria/${articulo.categoria_slug}`}
                  className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] px-3 py-1.5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400 transition hover:bg-emerald-400/[0.08]">
                  {articulo.categoria_nombre}
                </Link>
              )}

              {/* Casos de éxito */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Casos de éxito</p>
                <div className="flex flex-col gap-3">
                  {CASOS_EXITO.map((c) => (
                    <div key={c.empresa} className="border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                      <p className="text-xs font-semibold text-zinc-100">{c.empresa}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-emerald-400">{c.resultado}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-600">{c.detalle}</p>
                    </div>
                  ))}
                </div>
                <Link href="/signup"
                  className="mt-3 block rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-1.5 text-center text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20">
                  Ver demo →
                </Link>
              </div>

              {/* Recursos */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Recursos</p>
                {[{ label: "Documentación", href: "#" }, { label: "API Reference", href: "#" }, { label: "Plantillas", href: "/demo" }].map((r) => (
                  <Link key={r.label} href={r.href}
                    className="flex items-center gap-1.5 py-1 text-xs text-zinc-400 transition hover:text-emerald-300">
                    <span className="text-emerald-500/60">›</span> {r.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Artículo principal ── */}
          <article className="min-w-0 flex-1">
            <Link href="/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-emerald-400 transition hover:text-emerald-300 lg:hidden">
              ← Volver al blog
            </Link>

            {/* Hero del artículo */}
            <header className="mb-8">
              {articulo.categoria_slug && articulo.categoria_nombre && (
                <Link href={`/blog/categoria/${articulo.categoria_slug}`}
                  className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-400 transition hover:text-emerald-300">
                  {articulo.categoria_nombre}
                </Link>
              )}
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl lg:text-5xl">{articulo.titulo}</h1>
              <p className="mt-4 text-base text-zinc-400 md:text-lg">{articulo.resumen}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                <span className="font-medium text-zinc-300">{articulo.autor_nombre}</span>
                <span>·</span>
                <time dateTime={articulo.publicado_en ?? articulo.creado_en}>{fechaFormateada}</time>
                <span>·</span>
                <span>{articulo.tiempo_lectura_min} min de lectura</span>
              </div>
            </header>

            {/* Imagen portada */}
            {articulo.imagen_portada_url && (
              <div className="mb-8 w-full overflow-hidden rounded-2xl border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={articulo.imagen_portada_url}
                  alt={articulo.imagen_portada_alt ?? articulo.titulo}
                  className="w-full aspect-[4/3] sm:aspect-video object-cover"
                  loading="eager"
                />
              </div>
            )}

            {/* Tabla de contenidos — inline antes del cuerpo */}
            {tocItems.length >= 2 && (
              <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">En este artículo</p>
                <TablaContenidos items={tocItems} />
              </div>
            )}

            {/* Cuerpo del artículo */}
            <div className="prose prose-invert prose-emerald max-w-none prose-headings:tracking-tight prose-a:text-emerald-400 prose-code:text-emerald-300">
              <RenderMarkdown md={articulo.contenido_md} />
            </div>

            {/* CTA footer */}
            <div className="mt-14 overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/60 to-zinc-900/60 p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-400">¿Te resultó útil?</p>
              <h3 className="mt-2 text-xl font-bold">Probá Sass-CRM gratis — sin tarjeta</h3>
              <p className="mt-2 text-sm text-zinc-400">Conectá tu WhatsApp en 60 segundos y empezá a vender con IA.</p>
              <Link href="/signup"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400">
                Crear cuenta gratis →
              </Link>
            </div>
          </article>

          {/* ── Sidebar derecho — autor + stats + compartir ── */}
          <aside className="hidden w-52 shrink-0 xl:block">
            <div className="sticky top-20 flex flex-col gap-5">
              {/* Tarjeta autor */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Autor</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-sm font-bold text-emerald-300">
                    {articulo.autor_nombre[0]?.toUpperCase() ?? "A"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{articulo.autor_nombre}</p>
                    <p className="text-[10px] text-zinc-500">{fechaFormateada}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="font-display text-lg text-emerald-300">{articulo.tiempo_lectura_min}</p>
                    <p className="text-[9px] text-zinc-600">min lectura</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2 text-center">
                    <p className="font-display text-lg text-emerald-300">{articulo.contenido_md.split(/\s+/).length}</p>
                    <p className="text-[9px] text-zinc-600">palabras</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-emerald-400">Probá gratis</p>
                <p className="mt-2 text-xs font-semibold text-zinc-100">Automatizá tu WhatsApp con IA en 30 minutos.</p>
                <Link href="/signup"
                  className="mt-3 block rounded-lg bg-emerald-500 px-4 py-2 text-center text-xs font-bold text-black transition hover:bg-emerald-400">
                  Empezar ahora →
                </Link>
                <p className="mt-1.5 text-center font-mono text-[9px] text-zinc-600">Sin tarjeta · ≤ 2 min</p>
              </div>

              <FormularioSuscripcion />

              {/* Métricas plataforma */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">La plataforma</p>
                {[{ n: "1.2k+", label: "Msg/día" }, { n: "98%", label: "Respuesta" }, { n: "< 4s", label: "Latencia IA" }].map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between border-b border-white/[0.04] py-1.5 last:border-0">
                    <span className="font-display text-base text-emerald-300">{s.n}</span>
                    <span className="text-[10px] text-zinc-600">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Compartir */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Compartir</p>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(articulo.titulo)}&url=${encodeURIComponent(articuloUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-100">
                  <span>𝕏</span> Twitter / X
                </a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articuloUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-100">
                  <span>in</span> LinkedIn
                </a>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${articulo.titulo} ${articuloUrl}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-xs text-zinc-400 transition hover:border-white/20 hover:text-zinc-100">
                  <span>💬</span> WhatsApp
                </a>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
