import Link from "next/link";
import { RevealOnScroll } from "@/components/RevealOnScroll";

// ============================================================
// PRECIOS — 3 cards + tabla comparativa premium con check/cross
// ============================================================
const PLANES = [
  {
    n: "Gratis",
    p: "$0",
    u: "siempre",
    d: "Para probar con un número y ver si funciona para tu negocio.",
    items: [
      "1 cuenta WhatsApp",
      "100 conversaciones / mes",
      "GPT-4o-mini",
      "Pipeline + agenda + productos",
      "Soporte por chat",
    ],
    cta: "Empezar gratis",
    href: "/signup",
    destacado: false,
  },
  {
    n: "Pro",
    p: "$29",
    u: "/ mes · cuenta",
    d: "Para negocios que ya venden por WhatsApp y quieren escalar sin contratar.",
    items: [
      "WhatsApp ilimitados",
      "Conversaciones ilimitadas",
      "Voz clonada + Vapi",
      "Multi-modelo (GPT-4o · Claude)",
      "Soporte prioritario",
    ],
    cta: "Ver demostración en vivo",
    href: "/demo",
    destacado: true,
  },
  {
    n: "Business",
    p: "Custom",
    u: "white-label",
    d: "Agencias y SaaS que revenden a sus clientes.",
    items: [
      "Dominio propio + branding",
      "API completa",
      "Multi-usuario por tenant",
      "Onboarding dedicado",
      "SLA 99.9%",
    ],
    cta: "Hablar con ventas",
    href: "/contacto",
    destacado: false,
  },
];

// Filas de la tabla comparativa. v = "yes" | "no" | string
const FILAS_COMPARATIVA: Array<{
  titulo: string;
  valores: [string | "yes" | "no", string | "yes" | "no", string | "yes" | "no"];
}> = [
  { titulo: "Cuentas de WhatsApp", valores: ["1", "Ilimitadas", "Ilimitadas"] },
  { titulo: "Conversaciones / mes", valores: ["100", "Ilimitadas", "Ilimitadas"] },
  { titulo: "Modelos IA disponibles", valores: ["GPT-4o-mini", "GPT-4o · Claude · Gemini", "Todos + custom"] },
  { titulo: "Pipeline Kanban", valores: ["yes", "yes", "yes"] },
  { titulo: "Agenda con recordatorios", valores: ["yes", "yes", "yes"] },
  { titulo: "Captación de leads (Apify)", valores: ["no", "yes", "yes"] },
  { titulo: "Estudio de imágenes IA", valores: ["no", "yes", "yes"] },
  { titulo: "Voz clonada + llamadas Vapi", valores: ["no", "yes", "yes"] },
  { titulo: "Dominio propio + white-label", valores: ["no", "no", "yes"] },
  { titulo: "API completa", valores: ["no", "no", "yes"] },
  { titulo: "Multi-usuario por cuenta", valores: ["no", "no", "yes"] },
  { titulo: "Soporte", valores: ["Chat", "Prioritario", "Onboarding dedicado"] },
  { titulo: "SLA", valores: ["—", "99.5%", "99.9%"] },
];

function CeldaComparativa({ valor }: { valor: string | "yes" | "no" }) {
  if (valor === "yes") {
    return (
      <span
        aria-label="Incluido"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="h-3 w-3"
          aria-hidden
        >
          <path
            d="M2.5 6.2l2.4 2.4L9.5 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (valor === "no") {
    return (
      <span
        aria-label="No incluido"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.04] text-white/25"
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className="h-3 w-3"
          aria-hidden
        >
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }
  return <span className="text-[13px] text-white/80">{valor}</span>;
}

export function Precios() {
  return (
    <section
      id="precios"
      className="relative border-y border-white/[0.06] bg-[#080808]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(16,185,129,0.10),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // pricing
            </p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              Precios{" "}
              <span className="font-display italic text-white/70">simples</span>
              . Sin letra chica.
            </h2>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            cobramos solo si te conviene · cancelás cuando quieras
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANES.map((plan, i) => (
            <RevealOnScroll key={plan.n} delay={i * 100}>
            <article
              className={`group relative flex flex-col rounded-2xl border p-7 transition-all ${
                plan.destacado
                  ? "border-emerald-400/40 bg-gradient-to-b from-emerald-400/[0.06] to-transparent shadow-[0_0_60px_-20px_rgba(52,211,153,0.5)] hover:shadow-[0_0_80px_-20px_rgba(52,211,153,0.8)]"
                  : "border-white/[0.08] bg-black hover:-translate-y-0.5 hover:border-white/20"
              }`}
            >
              {plan.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/50 bg-black px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300 shadow-[0_0_24px_-4px_rgba(52,211,153,0.6)]">
                  más popular
                </div>
              )}
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
                {plan.n}
              </h3>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-6xl tracking-tight text-white">
                  {plan.p}
                </span>
                <span className="font-mono text-[11px] tracking-wide text-white/40">
                  {plan.u}
                </span>
              </div>
              <p className="mt-3 text-sm text-white/55">{plan.d}</p>
              <ul className="mt-7 flex-1 space-y-2.5">
                {plan.items.map((it) => (
                  <li
                    key={it}
                    className="flex items-start gap-2.5 text-[13px] text-white/75"
                  >
                    <span
                      aria-hidden
                      className="mt-[7px] h-px w-3 shrink-0 bg-emerald-400"
                    />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  plan.destacado
                    ? "bg-emerald-400 text-black shadow-[0_0_28px_-4px_rgba(52,211,153,0.6)] hover:bg-emerald-300 hover:shadow-[0_0_44px_-4px_rgba(52,211,153,0.9)]"
                    : "border border-white/15 text-white/90 hover:border-white/40 hover:bg-white/[0.04]"
                }`}
              >
                <span>{plan.cta}</span>
                <span
                  aria-hidden
                  className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </article>
            </RevealOnScroll>
          ))}
        </div>

        {/* Tabla comparativa premium */}
        <div className="mt-20">
          <p className="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
            // comparativa
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th
                    scope="col"
                    className="px-5 py-4 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-white/40"
                  >
                    Feature
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/60"
                  >
                    Gratis
                  </th>
                  <th
                    scope="col"
                    className="relative px-5 py-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300"
                  >
                    Pro
                    <span
                      aria-hidden
                      className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/60"
                  >
                    Business
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {FILAS_COMPARATIVA.map((fila) => (
                  <tr
                    key={fila.titulo}
                    className="transition-colors hover:bg-white/[0.015]"
                  >
                    <td className="px-5 py-3.5 text-[13px] text-white/70">
                      {fila.titulo}
                    </td>
                    {fila.valores.map((v, i) => (
                      <td
                        key={i}
                        className={`px-5 py-3.5 text-center ${
                          i === 1 ? "bg-emerald-400/[0.02]" : ""
                        }`}
                      >
                        <CeldaComparativa valor={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ — accordion con + animado, agrupado
// ============================================================
const PREGUNTAS = [
  {
    q: "¿Esto banea mi WhatsApp?",
    a: "No. Usamos WhatsApp Web (no API oficial), límites diarios, jitter humano y respeto de horarios. Está diseñado para no quemar números.",
  },
  {
    q: "¿Necesito saber programar?",
    a: "No. Todo desde el panel: catálogo, prompt en lenguaje natural, integraciones pegando keys. Cero código.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Postgres con Row Level Security y encriptación. Cada usuario ve solo sus cuentas. Las claves de IA son privadas por cuenta.",
  },
  {
    q: "¿Cuánto tarda el setup?",
    a: "2 minutos crear cuenta + escanear QR. 30 minutos configurar catálogo y prompt. Vendiendo el mismo día.",
  },
  {
    q: "¿Puedo migrar de n8n / Wati / Botmaker?",
    a: "Sí. Te ayudamos a importar contactos y conversaciones. Curva de aprendizaje: 1 día comparado con n8n.",
  },
  {
    q: "¿Hay descuentos por volumen?",
    a: "Sí. Desde 10 cuentas hay descuento progresivo. Para agencias, ver plan Business (white-label).",
  },
];

export function PreguntasFrecuentes() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24 md:py-32">
      <RevealOnScroll>
        <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
          // faq
        </p>
        <h2 className="text-center text-4xl tracking-[-0.025em] text-white md:text-5xl">
          Preguntas{" "}
          <span className="font-display italic text-white/70">frecuentes</span>.
        </h2>
        <p className="mt-4 text-center text-base text-white/55">
          Si tu duda no está acá,{" "}
          <Link
            href="/contacto"
            className="text-emerald-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            escribinos
          </Link>
          .
        </p>
      </RevealOnScroll>
      <div className="mt-12 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {PREGUNTAS.map((p, i) => (
          <RevealOnScroll key={p.q} delay={i * 50}>
          <details className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md text-[15px] font-medium text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              <span>{p.q}</span>
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 font-mono text-xs text-white/50 transition-all group-open:rotate-45 group-open:border-emerald-400/40 group-open:bg-emerald-400/10 group-open:text-emerald-300"
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-white/60">
              {p.a}
            </p>
          </details>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// CTA FINAL — bloque editorial con doble glow
// ============================================================
export function CtaFinal() {
  return (
    <RevealOnScroll>
    <section className="mx-auto max-w-6xl px-6 pb-24 md:pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.08] via-black to-black p-10 md:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(52,211,153,0.20) 0, transparent 40%), radial-gradient(circle at 85% 80%, rgba(192,132,252,0.12) 0, transparent 40%)",
          }}
        />
        {/* Grid sutil dentro del CTA */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 90% 70% at 50% 50%, black 30%, transparent 80%)",
          }}
        />
        <div className="relative max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            // empezá hoy
          </p>
          <h2 className="text-4xl leading-[1.05] tracking-[-0.025em] text-white md:text-6xl">
            Tus competidores ya están automatizando.{" "}
            <span className="font-display italic text-emerald-300">
              ¿Vos qué esperás?
            </span>
          </h2>
          <p className="mt-6 max-w-xl text-base text-white/60">
            Probalo gratis, sin tarjeta. Si en 7 días no te convence, lo
            desconectás con un click. Tu número, tus contactos, tu historial.
            Nada queda acá retenido.
          </p>
          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.5)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <span>Crear cuenta gratis</span>
              <span
                aria-hidden
                className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:bg-white/[0.03] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Ya tengo cuenta
            </Link>
            <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 sm:inline">
              setup ≤ 2 min · sin tarjeta
            </span>
          </div>
        </div>
      </div>
    </section>
    </RevealOnScroll>
  );
}
