import Link from "next/link";
import { Navegacion, PieDePagina } from "@/app/_componentes-landing/Layout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import "./servicio-template.css";

type Trio = [string, string, string];

export interface ServicioConfig {
  accentHex: string;
  accentRgb: string;
  badge?: string;
  crumb: string;
  h1: Trio;
  description: string;
  btnPrimary: string;
  btnSecondary: string;
  featureLabel: string;
  h2Features: Trio;
  features: { n: string; t: string; d: string }[];
  metrics: { v: string; l: string; d: string }[];
  ctaH2: Trio;
  ctaBody: string;
  ctaPrimary: string;
}

export function ServicioTemplate({ c }: { c: ServicioConfig }) {
  const style = { "--accent": c.accentHex, "--accent-rgb": c.accentRgb } as React.CSSProperties;

  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]" style={style}>
      <Navegacion />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div aria-hidden className="sp-hero-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/servicios" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70">
              Servicios
            </Link>
            <span className="text-white/20">/</span>
            <span className="sp-crumb font-mono text-[10px] uppercase tracking-[0.2em]">{c.crumb}</span>
          </div>

          {c.badge && (
            <div className="sp-badge mb-7">
              <span className="sp-badge-dot" />
              {c.badge}
            </div>
          )}

          <h1 className="max-w-[22ch] text-[42px] leading-[1.02] tracking-[-0.03em] text-white md:text-[72px] md:leading-[0.95]">
            {c.h1[0]}{" "}
            <span className="sp-italic font-display italic">{c.h1[1]}</span>
            {c.h1[2]}
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-white/60">{c.description}</p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="sp-btn-primary group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.4)] transition-all"
            >
              <span>{c.btnPrimary}</span>
              <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link href="/demo" className="sp-btn-secondary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all">
              {c.btnSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-b border-white/[0.06] bg-black">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
            {c.metrics.map((m) => (
              <div key={m.l} className="group relative flex flex-col gap-1 bg-black px-5 py-6 hover:bg-white/[0.015]">
                <span className="font-display text-4xl tracking-tight text-white md:text-5xl">{m.v}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{m.l}</span>
                <span className="text-[11px] text-white/30">{m.d}</span>
                <span aria-hidden className="sp-metric-line" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative border-y border-white/[0.06] bg-[#080808]">
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mb-14 max-w-2xl">
            <p className="sp-label mb-4 font-mono text-[10px] uppercase tracking-[0.22em]">{c.featureLabel}</p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              {c.h2Features[0]}{" "}
              <span className="font-display italic text-white/60">{c.h2Features[1]}</span>
              {c.h2Features[2]}
            </h2>
          </div>
          <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
            {c.features.map((f) => (
              <RevealOnScroll key={f.n}>
                <article className="group relative flex flex-col gap-3 overflow-hidden bg-black p-7 transition-all hover:bg-white/[0.02]">
                  <div aria-hidden className="sp-feat-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="sp-feat-num font-mono text-[10px] tracking-[0.2em] transition-colors">{f.n}</span>
                  <h3 className="text-lg font-medium leading-snug text-white">{f.t}</h3>
                  <p className="text-sm leading-relaxed text-white/55">{f.d}</p>
                  <span aria-hidden className="sp-feat-line" />
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <RevealOnScroll>
          <div className="sp-cta-box relative overflow-hidden rounded-3xl border border-white/[0.08] p-10 md:p-16">
            <div aria-hidden className="sp-cta-glow pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative max-w-2xl">
              <h2 className="text-4xl leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
                {c.ctaH2[0]}{" "}
                <span className="sp-italic font-display italic">{c.ctaH2[1]}</span>
                {c.ctaH2[2]}
              </h2>
              <p className="mt-6 text-base text-white/60">{c.ctaBody}</p>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="sp-btn-primary group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all"
                >
                  <span>{c.ctaPrimary}</span>
                  <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
                <Link href="/servicios" className="text-sm text-white/50 hover:text-white">
                  Ver todos los servicios
                </Link>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      <PieDePagina />
    </main>
  );
}
