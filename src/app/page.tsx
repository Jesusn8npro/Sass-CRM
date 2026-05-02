import Link from "next/link";

/**
 * Landing pública. Todo el público no logueado aterriza acá.
 * Versión inicial Fase 6.A.1 — limpia y profesional.
 * En sub-fase 6.A.4 la rediseñamos estilo Zolutium con animaciones,
 * secciones de pricing, testimonios, etc.
 */
export default function PaginaLanding() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-emerald-50 dark:from-zinc-950 dark:to-emerald-950/20">
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/70 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white">
              S
            </div>
            <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Sass-CRM
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center md:px-6 md:py-24">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Beta abierta — invitaciones limitadas
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 md:text-6xl dark:text-zinc-100">
          Tu agente de WhatsApp
          <br />
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            que vende solo
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
          IA que responde, agenda, llama y cierra ventas en WhatsApp 24/7.
          Multi-cuenta, multi-negocio, todo en un panel. Conectás tu número
          en 30 segundos y arranca.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/40"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Sin tarjeta de crédito. Setup en 2 minutos.
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            titulo="IA que entiende"
            descripcion="Visión multimodal, transcripción de audio, respuestas mezcladas (texto + voz + imagen). Tu cliente no nota la diferencia."
            icono="🤖"
          />
          <Feature
            titulo="Llamadas con voz clonada"
            descripcion="Tu agente llama a leads automáticamente con tu voz clonada en ElevenLabs. Vapi lo orquesta. Cero código."
            icono="📞"
          />
          <Feature
            titulo="CRM completo"
            descripcion="Pipeline Kanban, productos con stock, agenda con recordatorios, captura de emails y teléfonos. Todo integrado."
            icono="📋"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-zinc-500 md:px-6">
          © {new Date().getFullYear()} Sass-CRM. Hecho en LATAM 🌎
        </div>
      </footer>
    </main>
  );
}

function Feature({
  titulo,
  descripcion,
  icono,
}: {
  titulo: string;
  descripcion: string;
  icono: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-emerald-500/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500/30">
      <div className="mb-3 text-3xl">{icono}</div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {titulo}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {descripcion}
      </p>
    </div>
  );
}
