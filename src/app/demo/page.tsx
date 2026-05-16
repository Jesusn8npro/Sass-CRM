import Link from "next/link";
import { Navegacion, PieDePagina } from "../_componentes-landing/Layout";
import { PLANTILLAS_INDUSTRIA } from "@/lib/plantillas-industria";

export const metadata = {
  title: "Probá nuestro agente sin registrarte",
  description:
    "Elegí tu industria y conversá con un agente IA configurado para tu rubro. Sin signup, sin tarjeta.",
};

// Pares de burbujas fijas por industria (user izquierda, bot derecha)
// para la mini-preview dentro de cada card.
const PREVIEW: Record<string, [string, string]> = {
  inmobiliaria: ["Hola, busco depto 2 amb en Palermo", "¡Hola! Tenemos 4 opciones desde USD 89.000 💚"],
  ecommerce:    ["¿Tienen el Nike Air en talle 42?", "Sí, en stock. ¿Lo querés en negro o blanco?"],
  restaurante:  ["¿Hacen delivery los domingos?", "¡Sí! De 12 a 22 h. Mínimo $3.500 🛵"],
  clinica:      ["Necesito turno con cardiología", "Claro, ¿preferís mañana o tarde?"],
  automotriz:   ["¿Tienen el Corolla 2024?", "Tenemos 3 unidades. ¿Querés ver colores?"],
  educacion:    ["¿Cuándo arranca el próximo curso?", "El 5 de junio. Te paso el temario 📚"],
  servicios:    ["Necesito un plomero para hoy", "Tenemos disponibilidad a las 15 h. ¿Confirmo?"],
};

function MiniChat({ industria }: { industria: string }) {
  const par = PREVIEW[industria] ?? ["¿Cómo puedo ayudarte?", "Con gusto te asesoro 😊"];
  return (
    <div className="mt-4 flex flex-col gap-1.5 rounded-xl border border-white/[0.05] bg-zinc-950/70 p-3">
      {/* burbuja usuario — izquierda, zinc */}
      <div className="flex justify-start">
        <span className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-1.5 text-[11px] leading-snug text-white/70">
          {par[0]}
        </span>
      </div>
      {/* burbuja bot — derecha, emerald tint */}
      <div className="flex justify-end">
        <span className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-900/40 px-3 py-1.5 text-[11px] leading-snug text-emerald-200/90 ring-1 ring-emerald-400/10">
          {par[1]}
        </span>
      </div>
    </div>
  );
}

/**
 * /demo — Selector visual de industria con mini-previews de chat.
 */
export default function PaginaDemo() {
  return (
    <main className="min-h-screen bg-zinc-950 font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Orb animado con mesh-drift-1 */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/[0.13] blur-[96px]"
          style={{ animation: "mesh-drift-1 14s ease-in-out infinite" }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-5%,rgba(16,185,129,0.14),transparent_60%)]" />

        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-16 md:pt-28">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Demo en vivo
          </div>

          <h1 className="max-w-[20ch] text-[40px] leading-[1.04] tracking-[-0.025em] text-white md:text-[72px] md:leading-[0.98]">
            Probá nuestro agente{" "}
            <span className="font-display italic text-emerald-300">
              sin registrarte
            </span>
            .
          </h1>

          <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-white/55 md:text-base">
            Elegí tu industria y conversá con un agente IA configurado para tu
            rubro. Catálogo de ejemplo, FAQ típicas y respuestas en español.
            Sin tarjeta, sin signup.
          </p>
        </div>
      </section>

      {/* ── Grid de industrias ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
            // elegí tu industria
          </p>
          <h2 className="text-3xl tracking-[-0.02em] text-white md:text-4xl">
            ¿A qué se dedica tu negocio?
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANTILLAS_INDUSTRIA.map((p) => (
            <Link
              key={p.id}
              href={`/demo/${p.id}`}
              className="group flex flex-col rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-zinc-900/80 hover:shadow-[0_0_32px_-8px_rgba(52,211,153,0.18)]"
            >
              {/* Cabecera de la card */}
              <div className="flex items-start justify-between">
                <span className="text-4xl">{p.emoji}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 transition-colors group-hover:text-emerald-300">
                  Probar →
                </span>
              </div>

              {/* Nombre y descripción */}
              <div className="mt-4">
                <p className="font-display text-2xl italic leading-tight text-white">
                  {p.nombre}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  {p.descripcion}
                </p>
              </div>

              {/* Mini chat preview */}
              <MiniChat industria={p.id} />

              {/* Footer de la card */}
              <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                <span>Agente: {p.agente_nombre_default}</span>
                <span className="h-3 w-px bg-white/10" />
                <span>{p.productos_ejemplo.length} productos demo</span>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA inferior */}
        <div className="mt-16 flex flex-col items-start gap-4 rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // listo para tu negocio
            </p>
            <h3 className="mt-2 text-2xl tracking-[-0.02em] text-white">
              ¿Te gustó? Configurá el tuyo en 2 minutos.
            </h3>
            <p className="mt-2 text-sm text-white/55">
              Conectás tu WhatsApp, elegís la industria y empezás a vender. Sin
              tarjeta para arrancar.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-3 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_28px_-4px_rgba(52,211,153,0.6)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_44px_-4px_rgba(52,211,153,0.9)]"
          >
            Crear cuenta gratis
            <span className="font-mono text-xs opacity-70">→</span>
          </Link>
        </div>
      </section>

      <PieDePagina />
    </main>
  );
}
