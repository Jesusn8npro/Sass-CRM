import Link from "next/link";
import type { Metadata } from "next";
import { listarArticulosPublicados, listarCategorias } from "@/lib/baseDatos";
import { urlAbsoluta } from "@/lib/blog/siteUrl";
import { BuscadorBlog } from "@/components/BuscadorBlog";
import { FormularioSuscripcion } from "@/components/FormularioSuscripcion";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog · INYECTAIA",
  description:
    "Estrategias, IA aplicada y mejores prácticas en WhatsApp Business para PYMEs en Latinoamérica.",
  alternates: { canonical: urlAbsoluta("/blog") },
  openGraph: {
    title: "Blog · INYECTAIA",
    description: "Estrategias, IA y WhatsApp Business para PYMEs.",
    url: urlAbsoluta("/blog"),
    type: "website",
    locale: "es",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog · INYECTAIA",
    description: "Estrategias, IA y WhatsApp Business para PYMEs.",
  },
};

export default async function PaginaBlogIndice() {
  const [articulos, categorias] = await Promise.all([
    listarArticulosPublicados({ limite: 50 }),
    listarCategorias(),
  ]);

  return (
    <div className="blog-page">
      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-10 lg:py-14">
        {/* Header editorial */}
        <header className="mb-10 border-b border-white/[0.06] pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--cyan)" }}>Blog</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Ideas que{" "}
            <span className="font-display italic" style={{ color: "var(--cyan)" }}>convierten</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm" style={{ color: "var(--ink-dim)" }}>
            Guías prácticas, casos reales y novedades para PYMEs que quieren vender
            más con automatización conversacional.
          </p>
        </header>

        {/* Layout 3 columnas */}
        <div className="flex gap-8">
          {/* ── Sidebar izquierdo ── */}
          <aside className="hidden w-52 shrink-0 lg:block">
            <div className="sticky top-20 flex flex-col gap-6">
              {/* Categorías */}
              <div>
                <p className="b-label">Categorías</p>
                <nav className="flex flex-col gap-1">
                  <Link href="/blog" className="b-category">
                    Todos los artículos
                  </Link>
                  {categorias.map((c) => (
                    <Link key={c.id} href={`/blog/categoria/${c.slug}`}
                      className="rounded-lg px-3 py-1.5 text-sm transition-all hover:bg-white/[0.04]"
                      style={{ color: "var(--ink-dim)", textDecoration: "none" }}>
                      {c.nombre}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Sobre el blog */}
              <div className="b-card">
                <span className="b-label">Acerca de</span>
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-dim)" }}>
                  Publicamos semanalmente guías sobre ventas, WhatsApp Business e IA
                  aplicada al comercio en Latam.
                </p>
                <Link href="/signup" className="b-btn" style={{ marginTop: 12 }}>
                  Probar gratis →
                </Link>
              </div>

              <FormularioSuscripcion />
            </div>
          </aside>

          {/* ── Contenido principal con buscador ── */}
          <main className="min-w-0 flex-1">
            <BuscadorBlog articulos={articulos} categorias={categorias} />
          </main>

          {/* ── Sidebar derecho ── */}
          <aside className="hidden w-52 shrink-0 xl:block">
            <div className="sticky top-20 flex flex-col gap-5">
              {/* CTA principal */}
              <div className="b-card" style={{ borderColor: "rgba(0,229,255,0.2)", background: "rgba(0,229,255,0.04)" }}>
                <span className="b-label" style={{ color: "var(--cyan)" }}>Comenzá hoy</span>
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  Automatizá tu WhatsApp con IA en 30 minutos.
                </p>
                <Link href="/signup" className="b-btn" style={{ marginTop: 16 }}>
                  Crear cuenta gratis
                </Link>
                <p className="text-center font-mono" style={{ fontSize: 9, color: "var(--ink-faint)", marginTop: 8 }}>
                  Sin tarjeta · Setup ≤ 2 min
                </p>
              </div>

              {/* Stats */}
              <div className="b-card">
                <span className="b-label">En números</span>
                {[
                  { n: "1.200+", label: "Mensajes/día" },
                  { n: "98%",    label: "Tasa respuesta" },
                  { n: "3.2s",   label: "Tiempo promedio" },
                ].map((s) => (
                  <div key={s.label} className="b-stat-row">
                    <span className="b-stat-num">{s.n}</span>
                    <span className="b-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
