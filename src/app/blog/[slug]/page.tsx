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
import "../blog.css";

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
    title: `${tituloSEO} · INYECTAIA`,
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
    twitter: {
      card: "summary_large_image", title: tituloSEO, description: descSEO,
      images: a.imagen_portada_url
        ? [a.imagen_portada_url]
        : [urlAbsoluta(`/og?titulo=${encodeURIComponent(tituloSEO)}&categoria=${encodeURIComponent(a.categoria_nombre ?? "")}&autor=${encodeURIComponent(a.autor_nombre)}&tiempo=${a.tiempo_lectura_min}`)],
    },
  };
}

const CASOS_EXITO = [
  { empresa: "Joyería Luna",           resultado: "+340% leads calificados", detalle: "Sector retail, Buenos Aires" },
  { empresa: "Clínica Odontológica+",  resultado: "98% citas confirmadas",    detalle: "Sector salud, Medellín" },
  { empresa: "Carnicería del Sur",     resultado: "Cero mensajes sin responder", detalle: "Sector food, CDMX" },
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
    publisher: { "@type": "Organization", name: "INYECTAIA", url: urlAbsoluta("/") },
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
      { "@type": "ListItem", position: 2, name: "Blog",   item: urlAbsoluta("/blog") },
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
    <div className="blog-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <BarraProgresoLectura />

      <div className="blog-wrap">
        <div className="blog-cols">

          {/* ── Sidebar izquierdo ── */}
          <aside className="blog-sidebar left">
            <div className="b-sticky">
              <Link href="/blog" className="b-back">← Volver al blog</Link>

              {articulo.categoria_slug && articulo.categoria_nombre && (
                <Link href={`/blog/categoria/${articulo.categoria_slug}`} className="b-category" style={{ marginTop: 12 }}>
                  {articulo.categoria_nombre}
                </Link>
              )}

              {/* Casos de éxito */}
              <div className="b-card" style={{ marginTop: 16 }}>
                <span className="b-label">Casos de éxito</span>
                {CASOS_EXITO.map((c) => (
                  <div key={c.empresa} className="b-case">
                    <p className="b-case-co">{c.empresa}</p>
                    <p className="b-case-res">{c.resultado}</p>
                    <p className="b-case-loc">{c.detalle}</p>
                  </div>
                ))}
                <Link href="/signup" className="b-btn" style={{ marginTop: 12 }}>Ver demo →</Link>
              </div>

              {/* Recursos */}
              <div className="b-card">
                <span className="b-label">Recursos</span>
                {[
                  { label: "Documentación", href: "#" },
                  { label: "API Reference",  href: "#" },
                  { label: "Plantillas",     href: "/demo" },
                ].map((r) => (
                  <Link key={r.label} href={r.href} className="b-resource-link">{r.label}</Link>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Artículo principal ── */}
          <main className="blog-main">
            <Link href="/blog" className="b-mob-back">← Volver al blog</Link>

            {/* Header */}
            <header className="b-art-head">
              {articulo.categoria_slug && articulo.categoria_nombre && (
                <Link href={`/blog/categoria/${articulo.categoria_slug}`} className="b-category">
                  {articulo.categoria_nombre}
                </Link>
              )}
              <h1 className="b-art-title">{articulo.titulo}</h1>
              <p className="b-art-summary">{articulo.resumen}</p>
              <div className="b-art-meta">
                <span className="b-art-meta-author">{articulo.autor_nombre}</span>
                <span>·</span>
                <time dateTime={articulo.publicado_en ?? articulo.creado_en}>{fechaFormateada}</time>
                <span>·</span>
                <span>{articulo.tiempo_lectura_min} min de lectura</span>
              </div>
            </header>

            {/* Portada */}
            {articulo.imagen_portada_url && (
              <div className="b-art-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={articulo.imagen_portada_url}
                  alt={articulo.imagen_portada_alt ?? articulo.titulo}
                  loading="eager"
                />
              </div>
            )}

            {/* TOC */}
            {tocItems.length >= 2 && (
              <div className="b-toc">
                <span className="b-label">En este artículo</span>
                <TablaContenidos items={tocItems} />
              </div>
            )}

            {/* Cuerpo */}
            <div className="b-prose">
              <RenderMarkdown md={articulo.contenido_md} />
            </div>

            {/* CTA footer */}
            <div className="b-art-cta">
              <span className="b-art-cta-label">¿Te resultó útil?</span>
              <h3>Probá INYECTAIA gratis — sin tarjeta</h3>
              <p>Conectá tu WhatsApp en 60 segundos y empezá a vender con IA.</p>
              <Link href="/signup" className="b-art-cta-btn">Crear cuenta gratis →</Link>
            </div>
          </main>

          {/* ── Sidebar derecho ── */}
          <aside className="blog-sidebar right">
            <div className="b-sticky">
              {/* Autor */}
              <div className="b-card">
                <span className="b-label">Autor</span>
                <div className="b-author-row">
                  <div className="b-author-avatar">
                    {articulo.autor_nombre[0]?.toUpperCase() ?? "A"}
                  </div>
                  <div>
                    <p className="b-author-name">{articulo.autor_nombre}</p>
                    <p className="b-author-date">{fechaFormateada}</p>
                  </div>
                </div>
                <div className="b-mini-grid">
                  <div className="b-mini-stat">
                    <div className="b-mini-num">{articulo.tiempo_lectura_min}</div>
                    <div className="b-mini-label">min lectura</div>
                  </div>
                  <div className="b-mini-stat">
                    <div className="b-mini-num">{articulo.contenido_md.split(/\s+/).length}</div>
                    <div className="b-mini-label">palabras</div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="b-card" style={{ borderColor: "rgba(0,229,255,0.2)", background: "rgba(0,229,255,0.04)" }}>
                <span className="b-label" style={{ color: "var(--cyan)" }}>Probá gratis</span>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                  Automatizá tu WhatsApp con IA en 30 minutos.
                </p>
                <Link href="/signup" className="b-btn">Empezar ahora →</Link>
                <p style={{ textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: "var(--ink-faint)", marginTop: 8 }}>
                  Sin tarjeta · ≤ 2 min
                </p>
              </div>

              <FormularioSuscripcion />

              {/* Stats plataforma */}
              <div className="b-card">
                <span className="b-label">La plataforma</span>
                {[
                  { n: "1.2k+", label: "Msg/día"   },
                  { n: "98%",   label: "Respuesta"  },
                  { n: "< 4s",  label: "Latencia IA" },
                ].map((s) => (
                  <div key={s.label} className="b-stat-row">
                    <span className="b-stat-num">{s.n}</span>
                    <span className="b-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Compartir */}
              <div className="b-card">
                <span className="b-label">Compartir</span>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(articulo.titulo)}&url=${encodeURIComponent(articuloUrl)}`}
                  target="_blank" rel="noopener noreferrer" className="b-share-link">
                  <span>𝕏</span> Twitter / X
                </a>
                <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articuloUrl)}`}
                  target="_blank" rel="noopener noreferrer" className="b-share-link">
                  <span>in</span> LinkedIn
                </a>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${articulo.titulo} ${articuloUrl}`)}`}
                  target="_blank" rel="noopener noreferrer" className="b-share-link">
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
