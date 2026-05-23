import type { Metadata } from "next";
import Link from "next/link";
import { Navegacion, PieDePagina } from "../../_componentes-landing/Layout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Agentes IA para WhatsApp — INYECTAIA",
  description:
    "Agentes de inteligencia artificial que responden tu WhatsApp en menos de 5 segundos, agendan citas y cierran ventas 24/7. Sin código, setup en 30 minutos.",
  alternates: { canonical: urlAbsoluta("/servicios/agentes-ia") },
  openGraph: {
    title: "Agentes IA para WhatsApp — INYECTAIA",
    siteName: "INYECTAIA",
  },
};

const FEATURES = [
  {
    n: "01",
    t: "Respuesta en menos de 5 segundos",
    d: "El agente procesa el mensaje, consulta tu base de conocimiento y responde con contexto. Velocidad humana imposible de igualar.",
  },
  {
    n: "02",
    t: "Configura conversando, sin código",
    d: "Contale a la IA tu negocio en lenguaje natural: nombre, tono, servicios, horarios. Ella arma el agente sola. Cero formularios.",
  },
  {
    n: "03",
    t: "Entiende texto, audio e imágenes",
    d: "GPT-4o ve las fotos que manda el cliente, escucha los audios y responde con la información precisa. Todo en la misma conversación.",
  },
  {
    n: "04",
    t: "Agenda citas automáticamente",
    d: "El agente ve tu calendario, ofrece horarios disponibles y confirma la cita. El cliente recibe recordatorio. Vos no hacés nada.",
  },
  {
    n: "05",
    t: "Captura datos en el pipeline",
    d: "Cada conversación que llega al pipeline tiene nombre, teléfono, email y resumen del lead. Sin buscar en el chat.",
  },
  {
    n: "06",
    t: "Anti-ban con jitter humano",
    d: "Tiempos de respuesta variables, límites diarios y respeto de horarios. Diseñado específicamente para no quemar tu número.",
  },
];

const PASOS = [
  {
    n: "01",
    t: "Conectás tu WhatsApp",
    d: "Escaneás un QR como WhatsApp Web. Tu número queda vinculado al panel en menos de 2 minutos. Sin instalar nada.",
    dur: "2 min",
  },
  {
    n: "02",
    t: "Configurás el agente conversando",
    d: "Le contás a la IA cómo es tu negocio, qué vendés, qué preguntas te hacen. Ella genera el prompt y el catálogo. Sin código.",
    dur: "30 min",
  },
  {
    n: "03",
    t: "El agente vende por vos",
    d: "24 horas, 7 días, sin sueldo ni quejarse. Responde, califica, agenda y manda el lead al pipeline. Vos solo cerrás los buenos.",
    dur: "∞",
  },
];

const METRICAS = [
  { v: "<5s", l: "tiempo de respuesta", d: "p99 menor a 8 segundos" },
  { v: "24/7", l: "disponible siempre", d: "fines de semana, madrugadas, feriados" },
  { v: "∞", l: "chats simultáneos", d: "sin colas, sin demoras" },
  { v: "0%", l: "comisión por venta", d: "lo que vendés es tuyo" },
];

export default function PaginaAgentesIA() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.22),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 75%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
          <div className="mb-6 flex items-center gap-3">
            <Link
              href="/servicios"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white/70"
            >
              Servicios
            </Link>
            <span className="text-white/20">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
              Agentes IA para WhatsApp
            </span>
          </div>

          <div className="flex items-center gap-2 mb-7">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/[0.05] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              IA activa
            </span>
          </div>

          <h1 className="max-w-[22ch] text-[42px] leading-[1.02] tracking-[-0.03em] text-white md:text-[76px] md:leading-[0.95]">
            Tu vendedor de WhatsApp{" "}
            <span className="font-display italic text-emerald-300">nunca</span>{" "}
            duerme, nunca falta, nunca se queja.
          </h1>

          <p className="mt-7 max-w-xl text-base leading-relaxed text-white/60">
            Un agente de IA que responde en{" "}
            <span className="text-white">menos de 5 segundos</span>, entiende
            texto, audio e imágenes, y lleva cada lead al pipeline. Setup en{" "}
            <span className="font-mono text-emerald-300">30 minutos</span> sin código.
          </p>

          <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.4)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <span>Activar mi agente gratis</span>
              <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/demo"
              className="group inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.04] px-6 py-3 text-sm font-medium text-emerald-200 transition-all hover:border-emerald-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Ver demo en vivo →
            </Link>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <section className="border-b border-white/[0.06] bg-black">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
            {METRICAS.map((m) => (
              <div key={m.l} className="group relative flex flex-col gap-1 bg-black px-5 py-6 transition-colors hover:bg-white/[0.015]">
                <span className="font-display text-4xl tracking-tight text-white md:text-5xl">{m.v}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{m.l}</span>
                <span className="text-[11px] text-white/30">{m.d}</span>
                <span aria-hidden className="absolute bottom-0 left-0 h-px w-0 bg-emerald-400 transition-all duration-500 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// activación</p>
          <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
            De cero a vendiendo en{" "}
            <span className="font-display italic text-white/60">tres pasos</span>.
          </h2>
          <p className="mt-5 text-base text-white/55">
            Sin programar, sin agencia, sin esperas. Si sabés mandar un mensaje por WhatsApp, ya sabés usar INYECTAIA.
          </p>
        </div>
        <div className="relative grid gap-px bg-white/[0.06] md:grid-cols-3">
          <div
            aria-hidden
            className="pointer-events-none absolute top-[68px] left-7 right-7 hidden h-px bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0 md:block"
          />
          {PASOS.map((p) => (
            <RevealOnScroll key={p.n}>
              <div className="group relative flex flex-col gap-4 bg-black p-7 transition-all hover:bg-white/[0.02]">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-7xl leading-none text-emerald-400/80 transition-colors group-hover:text-emerald-300">{p.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">{p.dur}</span>
                </div>
                <h3 className="text-lg font-medium text-white">{p.t}</h3>
                <p className="text-sm leading-relaxed text-white/55">{p.d}</p>
                <span aria-hidden className="absolute right-6 top-6 h-px w-8 bg-emerald-400/40 transition-all group-hover:w-12 group-hover:bg-emerald-400/70" />
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative border-y border-white/[0.06] bg-[#080808]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(16,185,129,0.08),transparent_50%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// capacidades</p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              Lo que el agente{" "}
              <span className="font-display italic text-white/60">sabe hacer</span>.
            </h2>
          </div>
          <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
            {FEATURES.map((f) => (
              <RevealOnScroll key={f.n}>
                <article className="group relative flex flex-col gap-3 overflow-hidden bg-black p-7 transition-all hover:bg-white/[0.02]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.06),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-white/35 transition-colors group-hover:text-emerald-300">{f.n}</span>
                  <h3 className="text-lg font-medium leading-snug text-white">{f.t}</h3>
                  <p className="text-sm leading-relaxed text-white/55">{f.d}</p>
                  <span aria-hidden className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-400/80 to-transparent transition-all duration-500 group-hover:w-2/3" />
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.08] via-black to-black p-10 md:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 20%, rgba(52,211,153,0.20) 0, transparent 40%), radial-gradient(circle at 85% 80%, rgba(192,132,252,0.10) 0, transparent 40%)",
              }}
            />
            <div className="relative max-w-2xl">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
                // activá hoy
              </p>
              <h2 className="text-4xl leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
                Tu competencia ya está usando IA en WhatsApp.{" "}
                <span className="font-display italic text-emerald-300">¿Vos cuándo?</span>
              </h2>
              <p className="mt-6 text-base text-white/60">
                Gratis para empezar. Sin tarjeta. Si en 7 días no cerrás más ventas que ahora, lo desconectás con un click.
              </p>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.5)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.8)]"
                >
                  <span>Activar agente gratis</span>
                  <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
                <Link href="/servicios" className="text-sm text-white/50 transition-colors hover:text-white">
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
