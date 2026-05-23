import type { Metadata } from "next";
import Link from "next/link";
import { Navegacion, PieDePagina } from "../_componentes-landing/Layout";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Casos de Éxito — INYECTAIA",
  description:
    "Negocios reales que inyectaron IA con INYECTAIA y crecieron. E-commerce, odontología, inmobiliarias, restaurantes y más industrias de LATAM.",
  alternates: { canonical: urlAbsoluta("/trabajos") },
  openGraph: {
    title: "Casos de Éxito — INYECTAIA",
    description: "Resultados reales de negocios que automatizaron con INYECTAIA.",
    url: urlAbsoluta("/trabajos"),
    siteName: "INYECTAIA",
  },
};

const CASOS = [
  {
    industria: "E-commerce / Joyería",
    negocio: "Joyería Artesanal",
    pais: "Argentina",
    desafio: "Perdían ventas los fines de semana porque no había nadie para responder consultas de precios y disponibilidad.",
    solucion: "Agente IA con catálogo completo, fotos generadas por IA y respuesta automática 24/7.",
    resultados: [
      { v: "+340%", l: "ventas por WhatsApp" },
      { v: "0", l: "consultas sin respuesta" },
      { v: "3.2s", l: "tiempo de respuesta promedio" },
    ],
    tags: ["Agente IA", "Catálogo", "Fotos IA"],
    color: "emerald",
  },
  {
    industria: "Salud & Odontología",
    negocio: "Odontología Plus",
    pais: "Colombia",
    desafio: "La recepcionista pasaba el 70% del día respondiendo las mismas preguntas: precios, horarios, si hacían tal tratamiento.",
    solucion: "Agente IA que responde consultas, agenda turnos y manda recordatorios automáticos.",
    resultados: [
      { v: "-70%", l: "carga de recepción" },
      { v: "+45%", l: "turnos confirmados" },
      { v: "0%", l: "no-shows con recordatorio" },
    ],
    tags: ["Agendamiento", "Recordatorios", "FAQ automático"],
    color: "teal",
  },
  {
    industria: "Inmobiliaria",
    negocio: "Propiedades del Centro",
    pais: "México",
    desafio: "Perdían leads calificados que llegaban a las 11 PM preguntando por propiedades. Nadie respondía hasta el día siguiente.",
    solucion: "Agente IA que califica el interés, muestra propiedades disponibles y agenda visitas en tiempo real.",
    resultados: [
      { v: "+220%", l: "leads calificados" },
      { v: "11 PM", l: "hora del último cierre" },
      { v: "4×", l: "visitas agendadas por semana" },
    ],
    tags: ["Calificación IA", "Pipeline", "Agenda automática"],
    color: "violet",
  },
  {
    industria: "Restaurante & Delivery",
    negocio: "Parrilla del Sur",
    pais: "Uruguay",
    desafio: "El WhatsApp colapsaba durante las horas pico. Pedidos perdidos, clientes que se iban a la competencia.",
    solucion: "Agente IA que toma pedidos, confirma disponibilidad y estima el tiempo de entrega en tiempo real.",
    resultados: [
      { v: "+180%", l: "pedidos procesados" },
      { v: "0", l: "pedidos perdidos en hora pico" },
      { v: "+60%", l: "recompra por seguimiento IA" },
    ],
    tags: ["Pedidos automáticos", "Menú IA", "Fidelización"],
    color: "amber",
  },
  {
    industria: "Educación Online",
    negocio: "Academia de Marketing Digital",
    pais: "Perú",
    desafio: "Miles de interesados que llegaban por anuncios pero se perdían en el embudo porque nadie los atendía rápido.",
    solucion: "Agente IA + llamadas con voz clonada + prospección automática de potenciales alumnos.",
    resultados: [
      { v: "3×", l: "tasa de inscripción" },
      { v: "+500", l: "leads prospectados por semana" },
      { v: "-80%", l: "costo por alumno captado" },
    ],
    tags: ["Llamadas IA", "Prospección", "Funnel automático"],
    color: "fuchsia",
  },
  {
    industria: "Gym & Bienestar",
    negocio: "FitZone",
    pais: "Chile",
    desafio: "Alta rotación de socios. No tenían sistema para reactivar quienes dejaban de ir ni para convertir consultas en membresías.",
    solucion: "Agente IA para consultas + pipeline de leads + seguimiento automático de socios inactivos.",
    resultados: [
      { v: "+90%", l: "consultas convertidas" },
      { v: "-40%", l: "churn mensual" },
      { v: "24/7", l: "atención sin costo adicional" },
    ],
    tags: ["Retención", "Conversión", "Seguimiento IA"],
    color: "sky",
  },
];

const COLOR_BADGE: Record<string, string> = {
  emerald: "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-300",
  teal: "border-teal-400/20 bg-teal-400/[0.05] text-teal-300",
  violet: "border-violet-400/20 bg-violet-400/[0.05] text-violet-300",
  amber: "border-amber-400/20 bg-amber-400/[0.05] text-amber-300",
  fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/[0.05] text-fuchsia-300",
  sky: "border-sky-400/20 bg-sky-400/[0.05] text-sky-300",
};

const COLOR_METRIC: Record<string, string> = {
  emerald: "text-emerald-300",
  teal: "text-teal-300",
  violet: "text-violet-300",
  amber: "text-amber-300",
  fuchsia: "text-fuchsia-300",
  sky: "text-sky-300",
};

export default function PaginaTrabajos() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,185,129,0.18),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
          <p className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            // casos de éxito
          </p>
          <h1 className="mx-auto max-w-3xl text-[44px] leading-[1.02] tracking-[-0.03em] text-white md:text-[72px] md:leading-[0.96]">
            Negocios reales.{" "}
            <span className="font-display italic text-emerald-300">Resultados reales</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55">
            No son pantallas de demo. Son negocios como el tuyo que activaron INYECTAIA y midieron los resultados.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
            <span>Argentina</span>
            <span className="text-white/20">·</span>
            <span>Colombia</span>
            <span className="text-white/20">·</span>
            <span>México</span>
            <span className="text-white/20">·</span>
            <span>Chile</span>
            <span className="text-white/20">·</span>
            <span>Perú</span>
            <span className="text-white/20">·</span>
            <span>Uruguay</span>
          </div>
        </div>
      </section>

      {/* Grid de casos */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-col gap-px bg-white/[0.06]">
          {CASOS.map((caso, i) => (
            <RevealOnScroll key={caso.negocio} delay={i * 50}>
              <article className="group relative flex flex-col gap-8 bg-black p-8 transition-all hover:bg-white/[0.015] md:flex-row md:items-start md:gap-12">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.03),transparent_50%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />

                {/* Info principal */}
                <div className="flex-1">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${COLOR_BADGE[caso.color]}`}>
                      {caso.industria}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                      {caso.pais}
                    </span>
                  </div>

                  <h2 className="mb-1 text-2xl font-medium text-white">{caso.negocio}</h2>

                  <div className="mt-5 space-y-3">
                    <div>
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Desafío</p>
                      <p className="text-sm leading-relaxed text-white/55">{caso.desafio}</p>
                    </div>
                    <div>
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Solución INYECTAIA</p>
                      <p className="text-sm leading-relaxed text-white/55">{caso.solucion}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {caso.tags.map((t) => (
                      <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Métricas */}
                <div className="flex shrink-0 flex-col gap-4 md:w-48">
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">Resultados</p>
                  {caso.resultados.map((r) => (
                    <div key={r.l} className="flex flex-col gap-0.5">
                      <span className={`font-display text-3xl tracking-tight ${COLOR_METRIC[caso.color]}`}>{r.v}</span>
                      <span className="text-[11px] text-white/45">{r.l}</span>
                    </div>
                  ))}
                </div>

                <span aria-hidden className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-400/50 to-transparent transition-all duration-500 group-hover:w-1/3" />
              </article>
            </RevealOnScroll>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
          Resultados representativos basados en datos reales de clientes · Los resultados individuales varían según industria, mercado y uso
        </p>
      </div>

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
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
                // tu caso de éxito
              </p>
              <h2 className="text-4xl leading-[1.05] tracking-[-0.025em] text-white md:text-5xl">
                El próximo caso de éxito{" "}
                <span className="font-display italic text-emerald-300">puede ser el tuyo</span>.
              </h2>
              <p className="mt-6 text-base text-white/60">
                Empezá gratis. Sin tarjeta. En 30 minutos tu agente IA está respondiendo WhatsApp.
                En 30 días, estás midiendo resultados.
              </p>
              <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.5)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.8)]"
                >
                  <span>Empezar gratis</span>
                  <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
                <Link href="/servicios" className="inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:text-white">
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
