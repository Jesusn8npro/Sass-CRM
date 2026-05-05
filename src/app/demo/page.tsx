import Link from "next/link";
import { Navegacion, PieDePagina } from "../_componentes-landing/Layout";
import { PLANTILLAS_INDUSTRIA } from "@/lib/plantillas-industria";

export const metadata = {
  title: "Probá nuestro agente sin registrarte",
  description:
    "Elegí tu industria y conversá con un agente IA configurado para tu rubro. Sin signup, sin tarjeta.",
};

/**
 * /demo — Landing del demo público. Selector visual de industria.
 * Cada card linkea a /demo/[idIndustria] (chat sandbox).
 */
export default function PaginaDemo() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.18),transparent_60%)]" />

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

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
            // elegí tu industria
          </p>
          <h2 className="text-3xl tracking-[-0.02em] text-white md:text-4xl">
            ¿A qué se dedica tu negocio?
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANTILLAS_INDUSTRIA.map((p) => (
            <Link
              key={p.id}
              href={`/demo/${p.id}`}
              className="group flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between">
                <span className="text-4xl">{p.emoji}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 transition-colors group-hover:text-emerald-300">
                  Probar →
                </span>
              </div>
              <div>
                <p className="font-display text-2xl italic leading-tight text-white">
                  {p.nombre}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {p.descripcion}
                </p>
              </div>
              <div className="flex items-center gap-3 border-t border-white/[0.06] pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                <span>Agente: {p.agente_nombre_default}</span>
                <span className="h-3 w-px bg-white/10" />
                <span>{p.productos_ejemplo.length} productos demo</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 sm:flex-row sm:items-center sm:justify-between">
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
