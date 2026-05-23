import type { Metadata } from "next";
import Link from "next/link";
import { Navegacion, PieDePagina } from "../../_componentes-landing/Layout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Integraciones & API — INYECTAIA",
  description:
    "Conecta INYECTAIA con tu CRM, ERP, e-commerce o cualquier herramienta vía webhooks y API REST. White-label para agencias.",
  alternates: { canonical: urlAbsoluta("/servicios/integraciones") },
  openGraph: { title: "Integraciones & API — INYECTAIA", siteName: "INYECTAIA" },
};

const INTEGRACIONES = [
  { nombre: "OpenAI / GPT-4o", desc: "Modelo de IA principal para conversación y análisis", categoria: "IA" },
  { nombre: "ElevenLabs", desc: "Clonación de voz ultra-realista", categoria: "Voz" },
  { nombre: "Vapi", desc: "Llamadas telefónicas automáticas con IA", categoria: "Voz" },
  { nombre: "Apify", desc: "Scraping de leads en tiempo real", categoria: "Datos" },
  { nombre: "Supabase", desc: "Base de datos segura y escalable", categoria: "Infra" },
  { nombre: "Resend", desc: "Emails transaccionales de alta entregabilidad", categoria: "Email" },
  { nombre: "PayPal", desc: "Pagos y suscripciones globales", categoria: "Pagos" },
  { nombre: "WhatsApp Web", desc: "Conexión sin API oficial, anti-ban", categoria: "Mensajería" },
];

const FEATURES = [
  {
    n: "01",
    t: "API REST completa",
    d: "Cada recurso de INYECTAIA tiene endpoints documentados. Conversaciones, leads, pipeline, agentes. Hacés lo que quieras desde tu sistema.",
  },
  {
    n: "02",
    t: "Webhooks en tiempo real",
    d: "Cuando llega un lead, cuando se agenda una cita o cuando se cierra una venta, tu sistema recibe una notificación al instante.",
  },
  {
    n: "03",
    t: "White-label para agencias",
    d: "Usás INYECTAIA con tu dominio y branding. Tus clientes ven tu marca, no la nuestra. Revendé a precio que quieras.",
  },
  {
    n: "04",
    t: "Multi-tenant por cuenta",
    d: "Cada cliente de tu agencia tiene su cuenta aislada. Sus datos, sus agentes, sus conversaciones. Separación total.",
  },
  {
    n: "05",
    t: "Keys de IA por cuenta",
    d: "Cada cliente puede usar su propia key de OpenAI o Anthropic. Vos controlás qué modelo usa cada uno.",
  },
  {
    n: "06",
    t: "Seguridad HMAC en webhooks",
    d: "Todos los webhooks salientes validan firma HMAC. Ningún actor externo puede inyectar datos falsos en tu sistema.",
  },
];

export default function PaginaIntegraciones() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(14,165,233,0.18),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/servicios" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/70">Servicios</Link>
            <span className="text-white/20">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">Integraciones & API</span>
          </div>

          <h1 className="max-w-[22ch] text-[42px] leading-[1.02] tracking-[-0.03em] text-white md:text-[72px] md:leading-[0.95]">
            INYECTAIA se conecta{" "}
            <span className="font-display italic text-sky-300">a todo</span>{" "}
            tu stack.
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-white/60">
            API REST completa, webhooks en tiempo real y white-label para agencias. Conectá INYECTAIA a tu CRM, ERP o cualquier herramienta en minutos.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link href="/contacto" className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.4)] transition-all hover:bg-sky-300 hover:shadow-[0_0_60px_-8px_rgba(14,165,233,0.7)]">
              <span>Hablar con un desarrollador</span>
              <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/[0.04] px-6 py-3 text-sm font-medium text-sky-200 transition-all hover:border-sky-400/60 hover:text-white">
              Ver documentación →
            </Link>
          </div>
        </div>
      </section>

      {/* Stack de integraciones */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-sky-400">// stack tecnológico</p>
          <h2 className="text-3xl tracking-[-0.025em] text-white md:text-4xl">
            Las mejores herramientas,{" "}
            <span className="font-display italic text-white/60">ya integradas</span>.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
          {INTEGRACIONES.map((i) => (
            <RevealOnScroll key={i.nombre}>
              <div className="group flex flex-col gap-2 bg-black p-5 transition-all hover:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-white/90">{i.nombre}</span>
                  <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.05] px-2 py-px font-mono text-[8px] uppercase tracking-[0.15em] text-sky-300/70">
                    {i.categoria}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-white/40">{i.desc}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      <section className="relative border-y border-white/[0.06] bg-[#080808]">
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-sky-400">// capacidades técnicas</p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              API pensada para{" "}
              <span className="font-display italic text-white/60">developers serios</span>.
            </h2>
          </div>
          <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
            {FEATURES.map((f) => (
              <RevealOnScroll key={f.n}>
                <article className="group relative flex flex-col gap-3 overflow-hidden bg-black p-7 transition-all hover:bg-white/[0.02]">
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(14,165,233,0.06),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-white/35 transition-colors group-hover:text-sky-300">{f.n}</span>
                  <h3 className="text-lg font-medium leading-snug text-white">{f.t}</h3>
                  <p className="text-sm leading-relaxed text-white/55">{f.d}</p>
                  <span aria-hidden className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-sky-400/80 to-transparent transition-all duration-500 group-hover:w-2/3" />
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-sky-400/[0.07] via-black to-black p-10 md:p-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, rgba(14,165,233,0.16) 0, transparent 40%)" }} />
            <div className="relative max-w-2xl">
              <h2 className="text-4xl leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
                ¿Querés vender INYECTAIA con{" "}
                <span className="font-display italic text-sky-300">tu marca</span>?
              </h2>
              <p className="mt-6 text-base text-white/60">
                Plan Business con white-label, API completa y onboarding dedicado. Empezá a construir tu propio SaaS de IA encima de INYECTAIA.
              </p>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link href="/contacto" className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:bg-sky-300">
                  <span>Hablar con ventas</span>
                  <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
                <Link href="/servicios" className="text-sm text-white/50 hover:text-white">Ver todos los servicios</Link>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      <PieDePagina />
    </main>
  );
}
