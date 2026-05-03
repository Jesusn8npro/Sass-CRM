import Link from "next/link";

export function Precios() {
  return (
    <section id="precios" className="border-y border-zinc-200 bg-zinc-50/50 py-20 md:py-28 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Precios simples. Sin letra chica.
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
            Empezás gratis. Cuando vendas más, escalás.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:mt-16 md:grid-cols-3">
          <PlanPrecio
            nombre="Gratis"
            precio="$0"
            unidad="para siempre"
            descripcion="Para probar el sistema con un número de WhatsApp."
            beneficios={[
              "1 cuenta de WhatsApp",
              "Hasta 100 conversaciones/mes",
              "IA con GPT-4o-mini",
              "Pipeline + productos + agenda",
              "Comunidad y soporte por chat",
            ]}
            cta="Empezar gratis"
            destacado={false}
          />
          <PlanPrecio
            nombre="Pro"
            precio="$29"
            unidad="/mes por cuenta"
            descripcion="Para emprendedores que ya venden por WhatsApp."
            beneficios={[
              "WhatsApp ilimitados",
              "Conversaciones ilimitadas",
              "Voz clonada + llamadas Vapi",
              "Multi-modelo (GPT-4o, Claude)",
              "Soporte prioritario",
            ]}
            cta="Probar Pro 7 días"
            destacado={true}
          />
          <PlanPrecio
            nombre="Business"
            precio="A medida"
            unidad="white-label"
            descripcion="Agencias y SaaS que revenden el producto a sus clientes."
            beneficios={[
              "Dominio propio + branding",
              "API completa",
              "Multi-usuario por tenant",
              "Onboarding dedicado",
              "SLA 99.9%",
            ]}
            cta="Hablar con ventas"
            destacado={false}
          />
        </div>
      </div>
    </section>
  );
}

export function PlanPrecio({
  nombre,
  precio,
  unidad,
  descripcion,
  beneficios,
  cta,
  destacado,
}: {
  nombre: string;
  precio: string;
  unidad: string;
  descripcion: string;
  beneficios: string[];
  cta: string;
  destacado: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        destacado
          ? "border-emerald-500 bg-white shadow-xl shadow-emerald-500/20 dark:bg-zinc-950"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      {destacado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Más popular
        </div>
      )}
      <h3 className="text-lg font-semibold">{nombre}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{precio}</span>
        <span className="text-sm text-zinc-500">{unidad}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{descripcion}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {beneficios.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
              />
            </svg>
            <span className="text-zinc-700 dark:text-zinc-300">{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-6 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
          destacado
            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400"
            : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

// ============================================================
// FAQ
// ============================================================
export function PreguntasFrecuentes() {
  const preguntas: Array<{ q: string; a: string }> = [
    {
      q: "¿Esto banea mi WhatsApp?",
      a: "No. Usamos WhatsApp Web (no API oficial), respetamos límites diarios, jitter entre envíos y horarios humanos. Diseñado específicamente para no quemar números.",
    },
    {
      q: "¿Necesito saber programar?",
      a: "No. Todo se configura desde el panel: subís catálogo, escribís el prompt en lenguaje natural, conectás Vapi pegando una key. Cero código.",
    },
    {
      q: "¿Mis datos están seguros?",
      a: "Sí. Todo en Postgres con Row Level Security y encriptación. Cada usuario ve solo sus cuentas. Las claves de IA y voz son privadas por cuenta.",
    },
    {
      q: "¿Puedo migrar de n8n / Wati / Botmaker?",
      a: "Sí. Te ayudamos a importar contactos y conversaciones. La curva de aprendizaje es de 1 día comparada con n8n.",
    },
    {
      q: "¿Cuánto tarda el setup?",
      a: "2 minutos para crear cuenta + escanear QR. 30 minutos para cargar catálogo y prompt. Listo para vender el mismo día.",
    },
    {
      q: "¿Hay descuentos por volumen?",
      a: "Sí. A partir de 10 cuentas hay descuento progresivo. Para agencias, ver plan Business (white-label).",
    },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 md:px-6 md:py-28">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Preguntas frecuentes
        </h2>
      </div>
      <div className="mt-10 space-y-3 md:mt-12">
        {preguntas.map((p) => (
          <details
            key={p.q}
            className="group rounded-xl border border-zinc-200 bg-white p-4 open:border-emerald-500/30 open:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
              {p.q}
              <span className="text-zinc-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {p.a}
            </p>
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
    <section className="mx-auto max-w-5xl px-4 pb-20 md:px-6 md:pb-28">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-10 text-center text-white shadow-2xl shadow-emerald-500/30 md:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <h2 className="relative text-3xl font-bold tracking-tight md:text-5xl">
          Tus competidores ya están automatizando.
          <br />
          <span className="text-emerald-100">¿Vos qué esperás?</span>
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-base text-emerald-50">
          Probalo gratis, sin tarjeta. Si no te gusta, lo desconectás en
          1 click.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-white px-7 py-3 text-base font-bold text-emerald-700 shadow-lg transition-all hover:scale-105"
          >
            Crear cuenta gratis →
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/30 bg-white/10 px-7 py-3 text-base font-medium text-white backdrop-blur hover:bg-white/20"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </section>
  );
}
