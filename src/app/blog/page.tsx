import Link from "next/link";
import type { Metadata } from "next";
import { listarArticulosPublicados, listarCategorias } from "@/lib/baseDatos";
import { urlAbsoluta } from "@/lib/blog/siteUrl";
import { BuscadorBlog } from "@/components/BuscadorBlog";
import { FormularioSuscripcion } from "@/components/FormularioSuscripcion";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Blog · Sass-CRM",
  description:
    "Estrategias, IA aplicada y mejores prácticas en WhatsApp Business para PYMEs en Latinoamérica.",
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Orb ambiental */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-[600px] w-[600px] opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "mesh-drift-1 20s ease-in-out infinite",
        }}
      />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 py-10 lg:py-14">
        {/* Header editorial */}
        <header className="mb-10 border-b border-white/[0.06] pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">Blog</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            Ideas que{" "}
            <span className="font-display italic text-emerald-300">convierten</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">
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
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Categorías</p>
                <nav className="flex flex-col gap-1">
                  <Link href="/blog"
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 transition-all hover:bg-emerald-400/15">
                    Todos los artículos
                  </Link>
                  {categorias.map((c) => (
                    <Link key={c.id} href={`/blog/categoria/${c.slug}`}
                      className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-zinc-100">
                      {c.nombre}
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Sobre el blog */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Acerca de</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Publicamos semanalmente guías sobre ventas, WhatsApp Business e IA
                  aplicada al comercio en Latam.
                </p>
                <Link href="/signup"
                  className="mt-3 block rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-center text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20">
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
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-emerald-400">Comenzá hoy</p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">
                  Automatizá tu WhatsApp con IA en 30 minutos.
                </p>
                <Link href="/signup"
                  className="mt-4 block rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-xs font-bold text-black transition hover:bg-emerald-400">
                  Crear cuenta gratis
                </Link>
                <p className="mt-2 text-center font-mono text-[9px] text-zinc-600">
                  Sin tarjeta · Setup ≤ 2 min
                </p>
              </div>

              {/* Stats */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">En números</p>
                {[
                  { n: "1.200+", label: "Mensajes/día" },
                  { n: "98%", label: "Tasa respuesta" },
                  { n: "3.2s", label: "Tiempo promedio" },
                ].map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="font-display text-lg text-emerald-300">{s.n}</span>
                    <span className="text-[11px] text-zinc-500">{s.label}</span>
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
