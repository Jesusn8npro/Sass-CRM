import type { Metadata } from "next";
import Link from "next/link";
import { Navegacion, PieDePagina } from "../_componentes-landing/Layout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Nosotros — INYECTAIA",
  description:
    "Somos el equipo detrás de INYECTAIA. Construimos herramientas de IA para que los negocios de LATAM vendan más, trabajen menos y crezcan más rápido.",
  alternates: { canonical: urlAbsoluta("/nosotros") },
  openGraph: {
    title: "Nosotros — INYECTAIA",
    description: "El equipo que inyecta IA en los negocios de LATAM.",
    url: urlAbsoluta("/nosotros"),
    siteName: "INYECTAIA",
  },
};

const VALORES = [
  {
    n: "01",
    t: "Resultados sobre promesas",
    d: "No vendemos sueños. Vendemos sistemas que producen resultados medibles: más leads, más ventas, menos horas manuales. El primer día.",
  },
  {
    n: "02",
    t: "IA que no reemplaza, multiplica",
    d: "La IA de INYECTAIA no reemplaza a tu equipo. Lo multiplica. Un vendedor con INYECTAIA puede atender lo que antes hacía un equipo de 5.",
  },
  {
    n: "03",
    t: "Simple por diseño",
    d: "Si no podés configurarlo en 30 minutos sin código, para nosotros no está listo. La simplicidad es nuestra principal feature.",
  },
  {
    n: "04",
    t: "Construido en LATAM para LATAM",
    d: "Entendemos cómo se vende en Buenos Aires, Bogotá, CDMX y Lima. Lenguaje, usos, horarios, herramientas. No somos una traducción.",
  },
];

const NUMEROS = [
  { v: "3.800+", l: "negocios activos", d: "en Argentina, Colombia, México y más" },
  { v: "4.2M+", l: "mensajes respondidos", d: "por agentes INYECTAIA este mes" },
  { v: "99.97%", l: "uptime histórico", d: "sin paradas programadas" },
  { v: "< 5s", l: "respuesta promedio", d: "de todos los agentes activos" },
];

const EQUIPO = [
  {
    nombre: "Desarrollo & IA",
    desc: "Ingenieros obsesionados con que la IA sea útil de verdad, no solo impresionante en demos.",
    tags: ["Next.js", "GPT-4o", "ElevenLabs", "Vapi"],
  },
  {
    nombre: "Producto",
    desc: "Diseñamos cada pantalla preguntándonos: ¿puede usarlo alguien que nunca tocó una herramienta de IA?",
    tags: ["UX", "No-code first", "Feedback loops"],
  },
  {
    nombre: "Éxito del Cliente",
    desc: "No somos soporte. Somos el equipo que se asegura de que tu agente venda desde el día 1.",
    tags: ["Onboarding", "24h respuesta", "LATAM"],
  },
];

export default function PaginaNosotros() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,185,129,0.18),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 75%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
            // quiénes somos
          </p>
          <h1 className="max-w-[26ch] text-[42px] leading-[1.02] tracking-[-0.03em] text-white md:text-[72px] md:leading-[0.95]">
            Construimos IA que{" "}
            <span className="font-display italic text-emerald-300">vende</span>.
            No IA que impresiona.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-white/60">
            Somos el equipo detrás de INYECTAIA. Nacimos en LATAM, construimos para LATAM, y sabemos exactamente cómo se vende por WhatsApp en Buenos Aires, Bogotá, CDMX y Lima.
          </p>
        </div>
      </section>

      {/* Números */}
      <section className="border-b border-white/[0.06] bg-black">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
            {NUMEROS.map((n) => (
              <div key={n.l} className="group relative flex flex-col gap-1 bg-black px-5 py-6 transition-colors hover:bg-white/[0.015]">
                <span className="font-display text-4xl tracking-tight text-white md:text-5xl">{n.v}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{n.l}</span>
                <span className="text-[11px] text-white/30">{n.d}</span>
                <span aria-hidden className="absolute bottom-0 left-0 h-px w-0 bg-emerald-400 transition-all duration-500 group-hover:w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Misión */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid gap-16 md:grid-cols-2">
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // nuestra misión
            </p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              Que cualquier PYME de LATAM{" "}
              <span className="font-display italic text-white/60">tenga la tecnología</span>{" "}
              que antes solo podían pagar las grandes empresas.
            </h2>
          </div>
          <div className="flex flex-col justify-center gap-6">
            <p className="text-base leading-relaxed text-white/60">
              Las grandes corporaciones llevan años automatizando ventas con IA. Tienen presupuesto, tienen desarrolladores, tienen agencias. Las PYMEs no.
            </p>
            <p className="text-base leading-relaxed text-white/60">
              Nosotros construimos INYECTAIA para cerrar esa brecha. Sin código, sin agencias, sin meses de implementación. Un panadero en Medellín puede tener el mismo agente de IA que una cadena de tiendas.
            </p>
            <p className="text-base leading-relaxed text-white/60">
              Y si lo configurás en 30 minutos, mejor para los dos.
            </p>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="relative border-y border-white/[0.06] bg-[#080808]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_0%_100%,rgba(16,185,129,0.07),transparent_50%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// valores</p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              Cómo pensamos cuando{" "}
              <span className="font-display italic text-white/60">construimos</span>.
            </h2>
          </div>
          <div className="grid gap-px bg-white/[0.06] md:grid-cols-2">
            {VALORES.map((v) => (
              <RevealOnScroll key={v.n}>
                <article className="group relative flex flex-col gap-4 bg-black p-8 transition-all hover:bg-white/[0.02]">
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.04),transparent_50%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="font-display text-5xl leading-none text-emerald-400/50 transition-colors group-hover:text-emerald-300/70">{v.n}</span>
                  <h3 className="text-xl font-medium text-white">{v.t}</h3>
                  <p className="text-sm leading-relaxed text-white/55">{v.d}</p>
                  <span aria-hidden className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-400/60 to-transparent transition-all duration-500 group-hover:w-1/2" />
                </article>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Equipo */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// el equipo</p>
          <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
            Personas reales detrás de{" "}
            <span className="font-display italic text-white/60">cada línea de código</span>.
          </h2>
        </div>
        <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
          {EQUIPO.map((e) => (
            <RevealOnScroll key={e.nombre}>
              <div className="group flex flex-col gap-4 bg-black p-8 transition-all hover:bg-white/[0.02]">
                <h3 className="text-xl font-medium text-white">{e.nombre}</h3>
                <p className="text-sm leading-relaxed text-white/55">{e.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {e.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/40"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24 md:pb-32">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.08] via-black to-black p-10 md:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ backgroundImage: "radial-gradient(circle at 15% 20%, rgba(52,211,153,0.20) 0, transparent 40%)" }}
            />
            <div className="relative max-w-2xl">
              <h2 className="text-4xl leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
                ¿Querés ser parte de la{" "}
                <span className="font-display italic text-emerald-300">revolución de IA en LATAM</span>?
              </h2>
              <p className="mt-6 text-base text-white/60">
                Empezá gratis. Sin tarjeta. Y si necesitás hablar con alguien del equipo antes de empezar, escribinos. Respondemos de verdad.
              </p>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link href="/signup" className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.5)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.8)]">
                  <span>Empezar gratis</span>
                  <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
                <Link href="/contacto" className="inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:text-white">
                  Hablar con el equipo
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
