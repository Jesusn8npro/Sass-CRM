import Link from "next/link";

// ============================================================
// PRECIOS — tres planes, plan central destacado
// ============================================================
const PLANES = [
  {
    n: "Gratis",
    p: "$0",
    u: "siempre",
    d: "Para validar el sistema con un número.",
    items: ["1 cuenta WhatsApp", "100 conversaciones/mes", "GPT-4o-mini", "Pipeline + agenda + productos", "Soporte por chat"],
    cta: "Empezar gratis",
    destacado: false,
  },
  {
    n: "Pro",
    p: "$29",
    u: "/mes · cuenta",
    d: "Para emprendedores que ya venden por WhatsApp.",
    items: ["WhatsApp ilimitados", "Conversaciones ilimitadas", "Voz clonada + Vapi", "Multi-modelo (GPT-4o · Claude)", "Soporte prioritario"],
    cta: "Ver demostración en vivo",
    destacado: true,
  },
  {
    n: "Business",
    p: "Custom",
    u: "white-label",
    d: "Agencias y SaaS que revenden a sus clientes.",
    items: ["Dominio propio + branding", "API completa", "Multi-usuario por tenant", "Onboarding dedicado", "SLA 99.9%"],
    cta: "Hablar con ventas",
    destacado: false,
  },
];

export function Precios() {
  return (
    <section id="precios" className="border-y border-white/[0.06] bg-[#080808]">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 max-w-2xl">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// pricing</p>
          <h2 className="text-4xl tracking-[-0.02em] text-white md:text-5xl">
            Precios{" "}
            <span className="font-display italic text-white/70">simples</span>.
            Sin letra chica.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {PLANES.map((plan) => (
            <article
              key={plan.n}
              className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                plan.destacado
                  ? "border-emerald-400/40 bg-gradient-to-b from-emerald-400/[0.04] to-transparent shadow-[0_0_60px_-20px_rgba(52,211,153,0.5)]"
                  : "border-white/[0.08] bg-black hover:border-white/20"
              }`}
            >
              {plan.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-black px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300">
                  más popular
                </div>
              )}
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">{plan.n}</h3>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-6xl tracking-tight text-white">{plan.p}</span>
                <span className="font-mono text-[11px] tracking-wide text-white/40">{plan.u}</span>
              </div>
              <p className="mt-3 text-sm text-white/55">{plan.d}</p>
              <ul className="mt-7 flex-1 space-y-2.5">
                {plan.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[13px] text-white/75">
                    <span className="mt-[7px] h-px w-3 shrink-0 bg-emerald-400" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-8 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-all ${
                  plan.destacado
                    ? "bg-emerald-400 text-black shadow-[0_0_28px_-4px_rgba(52,211,153,0.6)] hover:bg-emerald-300"
                    : "border border-white/15 text-white/85 hover:border-white/40 hover:bg-white/[0.04]"
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ
// ============================================================
const PREGUNTAS = [
  { q: "¿Esto banea mi WhatsApp?", a: "No. WhatsApp Web (no API oficial), límites diarios, jitter humano, horarios respetados. Diseñado para no quemar números." },
  { q: "¿Necesito saber programar?", a: "No. Todo desde el panel: catálogo, prompt en lenguaje natural, integraciones pegando keys. Cero código." },
  { q: "¿Mis datos están seguros?", a: "Sí. Postgres con Row Level Security y encriptación. Cada usuario ve solo sus cuentas. Las claves de IA son privadas por cuenta." },
  { q: "¿Puedo migrar de n8n / Wati / Botmaker?", a: "Sí. Te ayudamos a importar contactos y conversaciones. Curva de aprendizaje: 1 día comparado con n8n." },
  { q: "¿Cuánto tarda el setup?", a: "2 minutos crear cuenta + escanear QR. 30 minutos configurar catálogo y prompt. Vendiendo el mismo día." },
  { q: "¿Hay descuentos por volumen?", a: "Sí. Desde 10 cuentas hay descuento progresivo. Para agencias, ver plan Business (white-label)." },
];

export function PreguntasFrecuentes() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-24 md:py-32">
      <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// faq</p>
      <h2 className="text-center text-4xl tracking-[-0.02em] text-white md:text-5xl">
        Preguntas <span className="font-display italic text-white/70">frecuentes</span>.
      </h2>
      <div className="mt-12 divide-y divide-white/[0.06] border-y border-white/[0.06]">
        {PREGUNTAS.map((p) => (
          <details key={p.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium text-white/90">
              <span>{p.q}</span>
              <span className="font-mono text-xs text-white/30 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/55">{p.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// CTA FINAL
// ============================================================
export function CtaFinal() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 md:pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-emerald-400/[0.08] via-black to-black p-10 md:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(52,211,153,0.18) 0, transparent 40%), radial-gradient(circle at 85% 80%, rgba(192,132,252,0.12) 0, transparent 40%)",
          }}
        />
        <div className="relative max-w-2xl">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
            // empezá hoy
          </p>
          <h2 className="text-4xl leading-[1.05] tracking-[-0.02em] text-white md:text-6xl">
            Tus competidores ya están automatizando.{" "}
            <span className="font-display italic text-emerald-300">¿Vos qué esperás?</span>
          </h2>
          <p className="mt-6 max-w-xl text-base text-white/55">
            Probalo gratis, sin tarjeta. Si no te convence, lo desconectás
            en un click.
          </p>
          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.5)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.7)]"
            >
              Crear cuenta gratis
              <span className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
