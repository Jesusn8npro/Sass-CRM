import type { Metadata } from "next";
import Link from "next/link";
import { Navegacion, PieDePagina } from "../_componentes-landing/Layout";
import { CtaFinal } from "../_componentes-landing/Comercial";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Servicios de IA — INYECTAIA",
  description:
    "Inyectamos IA en cada área de tu negocio: WhatsApp, ventas, llamadas, prospección, análisis e integraciones. Sin código, resultados desde el día 1.",
  alternates: { canonical: urlAbsoluta("/servicios") },
  openGraph: {
    title: "Servicios de IA — INYECTAIA",
    description: "Todo lo que INYECTAIA puede hacer por tu negocio.",
    url: urlAbsoluta("/servicios"),
    siteName: "INYECTAIA",
  },
};

const SERVICIOS_DETALLE = [
  {
    href: "/servicios/agentes-ia",
    label: "Agentes IA para WhatsApp",
    desc: "Un agente que responde, agenda citas y cierra ventas las 24 horas sin que tengas que estar presente. Configurás en conversación natural, sin código.",
    metricas: ["< 5s respuesta", "24/7 sin parar", "∞ chats simultáneos"],
    icono: "◈",
    color: "emerald",
  },
  {
    href: "/servicios/automatizacion",
    label: "Automatización de Ventas",
    desc: "Pipeline Kanban donde la IA mueve los leads automáticamente según su comportamiento. Ves en tiempo real en qué etapa está cada prospecto.",
    metricas: ["Pipeline Kanban", "Scoring automático", "Seguimientos IA"],
    icono: "⬡",
    color: "teal",
  },
  {
    href: "/servicios/llamadas-ia",
    label: "Llamadas con Voz IA",
    desc: "Clonamos tu voz con ElevenLabs y tu agente llama leads automáticamente usando Vapi. El cliente siente que sos vos al teléfono.",
    metricas: ["Voz 100% clonada", "Llamadas automáticas", "Transcripción full"],
    icono: "◉",
    color: "violet",
  },
  {
    href: "/servicios/prospeccion",
    label: "Prospección Inteligente",
    desc: "Decile «restaurantes en Bogotá» o «dentistas en CDMX». En segundos tenés una lista con teléfono, email y web. Listos para contactar.",
    metricas: ["Leads en segundos", "Email + teléfono + web", "100% automatizado"],
    icono: "◎",
    color: "fuchsia",
  },
  {
    href: "/servicios/analisis",
    label: "Análisis & Reportes IA",
    desc: "Métricas en tiempo real de todas tus conversaciones, leads convertidos, ingresos generados y performance del agente. Sin exportar Excel.",
    metricas: ["Tiempo real", "Reportes automáticos", "KPIs de ventas"],
    icono: "◫",
    color: "amber",
  },
  {
    href: "/servicios/integraciones",
    label: "Integraciones & API",
    desc: "Conecta INYECTAIA con tu CRM, ERP, e-commerce o cualquier herramienta vía webhooks y API REST. White-label disponible para agencias.",
    metricas: ["API REST completa", "Webhooks en tiempo real", "White-label"],
    icono: "⬢",
    color: "sky",
  },
];

const COLOR_MAP: Record<string, string> = {
  emerald: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.04] group-hover:text-emerald-200",
  teal: "text-teal-300 border-teal-400/20 bg-teal-400/[0.04] group-hover:text-teal-200",
  violet: "text-violet-300 border-violet-400/20 bg-violet-400/[0.04] group-hover:text-violet-200",
  fuchsia: "text-fuchsia-300 border-fuchsia-400/20 bg-fuchsia-400/[0.04] group-hover:text-fuchsia-200",
  amber: "text-amber-300 border-amber-400/20 bg-amber-400/[0.04] group-hover:text-amber-200",
  sky: "text-sky-300 border-sky-400/20 bg-sky-400/[0.04] group-hover:text-sky-200",
};

const BADGE_MAP: Record<string, string> = {
  emerald: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
  teal: "border-teal-400/20 bg-teal-400/[0.06] text-teal-300",
  violet: "border-violet-400/20 bg-violet-400/[0.06] text-violet-300",
  fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/[0.06] text-fuchsia-300",
  amber: "border-amber-400/20 bg-amber-400/[0.06] text-amber-300",
  sky: "border-sky-400/20 bg-sky-400/[0.06] text-sky-300",
};

export default function PaginaServicios() {
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
            // todos los servicios
          </p>
          <h1 className="mx-auto max-w-3xl text-[44px] leading-[1.02] tracking-[-0.03em] text-white md:text-[72px] md:leading-[0.96]">
            IA inyectada en{" "}
            <span className="font-display italic text-emerald-300">cada parte</span>{" "}
            de tu negocio
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/55">
            Desde atender WhatsApp hasta prospectar clientes y llamarlos con tu voz clonada.
            Un ecosistema completo de IA para vender más sin contratar más.
          </p>
        </div>
      </section>

      {/* Grid de servicios */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-px bg-white/[0.06] md:grid-cols-2 lg:grid-cols-3">
          {SERVICIOS_DETALLE.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group relative flex flex-col gap-5 bg-black p-8 transition-all hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.04),transparent_50%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />

              <div className="flex items-start justify-between">
                <span className={`font-mono text-3xl transition-colors ${COLOR_MAP[s.color]}`}>
                  {s.icono}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25 transition-colors group-hover:text-white/40">
                  ver servicio →
                </span>
              </div>

              <div>
                <h2 className="text-xl font-medium leading-snug text-white">{s.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/50 transition-colors group-hover:text-white/60">
                  {s.desc}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {s.metricas.map((m) => (
                  <span
                    key={m}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] transition-all ${BADGE_MAP[s.color]}`}
                  >
                    {m}
                  </span>
                ))}
              </div>

              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-400/70 to-transparent transition-all duration-500 group-hover:w-2/3"
              />
            </Link>
          ))}
        </div>
      </section>

      <CtaFinal />
      <PieDePagina />
    </main>
  );
}
