import Link from "next/link";

// ============================================================
// HERO — editorial premium con KPIs flotantes y señal en vivo
// ============================================================
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      {/* Atmósfera: glow esmeralda + grid + viñeta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.22),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 75%)",
        }}
      />
      {/* Línea horizontal de escaneo sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[58%] h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28">
        {/* Píldora EN VIVO */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.05] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300 backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span>En vivo</span>
          <span className="text-emerald-400/40">·</span>
          <span>1.247 mensajes respondidos hoy</span>
        </div>

        <h1 className="max-w-[18ch] text-[44px] leading-[1.02] tracking-[-0.03em] text-white md:text-[88px] md:leading-[0.94]">
          Tu vendedor de WhatsApp{" "}
          <span className="font-display italic text-emerald-300">nunca</span>{" "}
          duerme.
        </h1>

        <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-white/60 md:text-base">
          Una IA que responde en{" "}
          <span className="text-white">menos de 5 segundos</span>, agenda
          turnos, llama leads con tu voz clonada y cierra ventas a las 3 AM.
          Setup en{" "}
          <span className="font-mono text-emerald-300">30 minutos</span>, cero
          código.
        </p>

        <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.4)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
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
            href="/demo"
            className="group inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.04] px-5 py-3 text-sm font-medium text-emerald-200 transition-all hover:border-emerald-400/60 hover:bg-emerald-400/[0.10] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Probar demo en vivo
            <span aria-hidden className="font-mono text-xs opacity-70 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/40 hover:bg-white/[0.03] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Ver cómo opera
          </Link>
          <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 sm:inline">
            sin tarjeta · setup ≤ 2 min
          </span>
        </div>

        <div className="mt-20 md:mt-24">
          <MockupPanel />
        </div>
      </div>
    </section>
  );
}

function MockupPanel() {
  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Glow detrás del mockup */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.20),transparent_60%)] blur-2xl"
      />

      {/* KPI flotante esquina sup. izq. */}
      <div className="absolute -left-2 -top-6 z-10 hidden rounded-xl border border-white/[0.08] bg-black/80 px-3.5 py-2.5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-md md:block">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
          tasa de respuesta
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-display text-2xl tracking-tight text-white">
            100%
          </span>
          <span className="font-mono text-[10px] text-emerald-400">↑ 24×7</span>
        </p>
      </div>

      {/* KPI flotante esquina sup. der. */}
      <div className="absolute -right-2 -top-4 z-10 hidden rounded-xl border border-emerald-400/30 bg-black/80 px-3.5 py-2.5 shadow-[0_10px_40px_-10px_rgba(52,211,153,0.3)] backdrop-blur-md md:block">
        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          respondió en
        </p>
        <p className="mt-0.5 font-display text-2xl tracking-tight text-white">
          3.2<span className="text-base text-white/50">s</span>
        </p>
      </div>

      {/* KPI flotante inferior */}
      <div className="absolute -bottom-4 left-1/2 z-10 hidden -translate-x-1/2 rounded-full border border-white/[0.08] bg-black/85 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-md md:block">
        <span className="text-emerald-400">+</span> 47 leads convertidos esta semana
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-black/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          <span className="ml-3 truncate font-mono text-[10px] tracking-wide text-white/30">
            sass-crm.app/cuentas/joyería
          </span>
          <span className="ml-auto hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-300 sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            IA activa
          </span>
        </div>
        <div className="grid grid-cols-12 text-left">
          <aside className="col-span-4 border-r border-white/[0.06] bg-white/[0.02] p-4 md:col-span-3">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
              Cuentas
            </p>
            <FilaSidebar
              inicial="MJ"
              nombre="Mi Joyería"
              tel="+54 11 5555-1234"
              activa
            />
            <FilaSidebar
              inicial="OD"
              nombre="Odontología Plus"
              tel="+57 300 222-4444"
            />
            <FilaSidebar
              inicial="CR"
              nombre="Carnicería del Sur"
              tel="+52 81 8888-1111"
            />
          </aside>
          <div className="col-span-8 p-5 md:col-span-9">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-[10px] font-semibold text-emerald-300">
                  AC
                </div>
                <div>
                  <div className="text-[13px] font-medium text-white">
                    Ana Cordero
                  </div>
                  <div className="font-mono text-[10px] text-white/40">
                    +54 9 11 4444-3333 · MODO IA
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">
                interesado
              </span>
            </div>
            <div className="space-y-1.5">
              <Burbuja lado="izq">
                Vi el anillo de oro 18k, ¿cuánto sale?
              </Burbuja>
              <Burbuja lado="der">
                ¡Hola Ana! Sale $185.000. Tenemos 3 medidas. ¿Querés ver fotos?
              </Burbuja>
              <Burbuja lado="izq">Sí, y métodos de pago.</Burbuja>
              <Burbuja lado="der" tipo="imagen">
                producto.jpg generado por IA
              </Burbuja>
              <Burbuja lado="der">
                Transferencia (5% off), MercadoPago 12 cuotas, efectivo. ¿Te paso turno?
              </Burbuja>
              <BurbujaEscribiendo />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaSidebar({
  inicial,
  nombre,
  tel,
  activa,
}: {
  inicial: string;
  nombre: string;
  tel: string;
  activa?: boolean;
}) {
  return (
    <div
      className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
        activa ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="relative flex h-6 w-6 items-center justify-center rounded bg-emerald-400/15 font-mono text-[9px] font-semibold text-emerald-300">
        {inicial}
        <span className="absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-[#0A0A0A]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] text-white/90">{nombre}</div>
        <div className="truncate font-mono text-[9px] text-white/40">{tel}</div>
      </div>
    </div>
  );
}

function Burbuja({
  lado,
  tipo,
  children,
}: {
  lado: "izq" | "der";
  tipo?: "imagen";
  children: React.ReactNode;
}) {
  const izq = lado === "izq";
  return (
    <div className={`flex ${izq ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-1.5 text-[12px] leading-snug ${
          izq
            ? "bg-white/[0.06] text-white/85"
            : tipo === "imagen"
              ? "bg-emerald-400/15 italic text-emerald-200"
              : "bg-emerald-400 text-black"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function BurbujaEscribiendo() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.06] px-3 py-2 text-[12px]">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60" />
      </div>
    </div>
  );
}

// ============================================================
// MÉTRICAS — terminal-style con barras micro-decorativas
// ============================================================
const METRICAS = [
  { v: "<5s", l: "respuesta promedio", d: "p99 bajo 8 segundos" },
  { v: "24/7", l: "uptime real", d: "sin pausas, sin turnos" },
  { v: "∞", l: "conversaciones simultáneas", d: "no se cuelga, no se traba" },
  { v: "0%", l: "comisión por venta", d: "lo que vendés es tuyo" },
];

export function Metricas() {
  return (
    <section
      aria-label="Métricas clave"
      className="border-b border-white/[0.06] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
          {METRICAS.map((m) => (
            <div
              key={m.l}
              className="group relative flex flex-col items-start gap-1 bg-black px-5 py-6 transition-colors hover:bg-white/[0.015]"
            >
              <span className="font-display text-4xl tracking-tight text-white md:text-5xl">
                {m.v}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                {m.l}
              </span>
              <span className="text-[11px] text-white/30">{m.d}</span>
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-px w-0 bg-emerald-400 transition-all duration-500 group-hover:w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CÓMO FUNCIONA — timeline con conector visual
// ============================================================
const PASOS = [
  {
    n: "01",
    t: "Conectá tu WhatsApp",
    d: "Escaneás un QR como WhatsApp Web. Tu número queda enlazado al panel en menos de 2 minutos.",
    duracion: "2 min",
  },
  {
    n: "02",
    t: "Cargá tu negocio",
    d: "Le contás a la IA cómo vendés: qué ofrecés, qué horarios, cómo respondés. Ella arma el agente. Cero formularios.",
    duracion: "30 min",
  },
  {
    n: "03",
    t: "Dejá que venda",
    d: "La IA responde, agenda, captura datos y los lleva al pipeline Kanban. Vos sólo cerrás.",
    duracion: "para siempre",
  },
];

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      className="mx-auto max-w-6xl px-6 py-24 md:py-32"
    >
      <div className="mb-14 max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
          // operación
        </p>
        <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
          De cero a vendiendo en{" "}
          <span className="font-display italic text-white/70">tres pasos</span>.
        </h2>
        <p className="mt-5 max-w-lg text-base text-white/55">
          Ningún paso requiere programar. Si sabés mandar un mensaje por WhatsApp, ya sabés usar esto.
        </p>
      </div>
      <div className="relative grid gap-px bg-white/[0.06] md:grid-cols-3">
        {/* Línea conectora horizontal */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[68px] left-7 right-7 hidden h-px bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0 md:block"
        />
        {PASOS.map((p) => (
          <div
            key={p.n}
            className="group relative flex flex-col gap-4 bg-black p-7 transition-all hover:bg-white/[0.02]"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-display text-7xl leading-none text-emerald-400/80 transition-colors group-hover:text-emerald-300">
                {p.n}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                {p.duracion}
              </span>
            </div>
            <h3 className="text-lg font-medium text-white">{p.t}</h3>
            <p className="text-sm leading-relaxed text-white/55">{p.d}</p>
            <span
              aria-hidden
              className="absolute right-6 top-6 h-px w-8 bg-emerald-400/40 transition-all group-hover:w-12 group-hover:bg-emerald-400/70"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// FUNCIONES — 6 destacadas con tarjetas premium + tira "incluye también"
// ============================================================
const FUNCIONES_DESTACADAS = [
  {
    n: "01",
    t: "Captación de leads con IA",
    d: "Decile «restaurantes en Bogotá» o «abogados en CDMX». Te llegan con teléfono, email y web, listos para contactar.",
    tag: "nuevo",
  },
  {
    n: "02",
    t: "Estudio de imágenes IA",
    d: "Subís una foto del producto, elegís el preset (fondo blanco, lifestyle, premium) y en segundos tenés la versión para vender.",
    tag: "nuevo",
  },
  {
    n: "03",
    t: "Configurás conversando",
    d: "Sin formularios. Conversás con la IA y ella configura el agente: nombre, tono, bienvenida, contexto de tu negocio.",
    tag: "nuevo",
  },
  {
    n: "04",
    t: "IA multimodal",
    d: "GPT-4o ve imágenes, escucha audios, responde en texto y en voz. Todo en la misma conversación, sin cambiar de canal.",
  },
  {
    n: "05",
    t: "Llamadas con voz clonada",
    d: "Tu agente llama leads con tu voz clonada (ElevenLabs + Vapi). El cliente piensa que sos vos al teléfono.",
  },
  {
    n: "06",
    t: "Pipeline Kanban",
    d: "Arrastrás las conversaciones entre etapas. Cada tarjeta tiene el historial completo del lead, sin buscar en el chat.",
  },
];

const FUNCIONES_EXTRA = [
  "Catálogo con stock y precio",
  "Agenda con recordatorios",
  "Créditos pay-as-you-go",
  "Multi-cuenta de WhatsApp",
  "Captura automática de email/teléfono",
  "Anti-ban con jitter humano",
];

export function Funciones() {
  return (
    <section
      id="funciones"
      className="relative border-y border-white/[0.06] bg-[#080808]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(16,185,129,0.08),transparent_50%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // stack
            </p>
            <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
              Un solo panel.{" "}
              <span className="font-display italic text-white/70">
                Todo adentro.
              </span>{" "}
              Nada de Zapier.
            </h2>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            sin Zapier · sin n8n · todo integrado
          </p>
        </div>

        <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
          {FUNCIONES_DESTACADAS.map((f) => (
            <article
              key={f.n}
              className="group relative flex flex-col gap-3 overflow-hidden bg-black p-7 transition-all hover:bg-white/[0.02]"
            >
              {/* Gradient overlay tenue en hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.06),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="relative flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/40 transition-colors group-hover:text-emerald-300">
                  {f.n}
                </span>
                {f.tag && (
                  <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-fuchsia-300">
                    {f.tag}
                  </span>
                )}
              </div>
              <h3 className="relative text-lg font-medium leading-snug text-white">
                {f.t}
              </h3>
              <p className="relative text-sm leading-relaxed text-white/55">
                {f.d}
              </p>
              {/* Línea inferior animada */}
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-400/80 to-transparent transition-all duration-500 group-hover:w-2/3"
              />
            </article>
          ))}
        </div>

        <div className="mt-px flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.06] bg-black px-7 py-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            incluye también
          </span>
          {FUNCIONES_EXTRA.map((e) => (
            <span key={e} className="text-[12px] text-white/65">
              <span aria-hidden className="mr-1.5 text-emerald-400">
                +
              </span>
              {e}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CASOS DE USO — tarjetas clickables con hover state premium
// ============================================================
const CASOS = [
  { t: "E-commerce / Joyería", d: "Catálogo, fotos IA, pagos", h: "/blog/whatsapp-ecommerce" },
  { t: "Odontología y salud", d: "Turnos, recordatorios, fichas", h: "/blog/whatsapp-odontologia" },
  { t: "Inmobiliarias", d: "Visitas, fichas, seguimiento", h: "/blog/whatsapp-inmobiliarias" },
  { t: "Restaurantes / Delivery", d: "Pedidos, menú, fidelización", h: "/blog/whatsapp-restaurantes" },
  { t: "Cursos online & coaching", d: "Inscripción, soporte 24/7", h: "/blog/whatsapp-cursos" },
  { t: "Estética y peluquería", d: "Agenda, precios, antes/después", h: "/blog/whatsapp-estetica" },
  { t: "Concesionarias y autos", d: "Test drives, financiación", h: "/blog/whatsapp-autos" },
  { t: "Gimnasios y bienestar", d: "Suscripciones, clases, planes", h: "/blog/whatsapp-gimnasios" },
];

export function CasosDeUso() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-12 max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
          // industrias
        </p>
        <h2 className="text-4xl tracking-[-0.025em] text-white md:text-5xl">
          Si tus clientes te escriben por WhatsApp,{" "}
          <span className="font-display italic text-white/70">
            acá los atendés
          </span>
          .
        </h2>
      </div>
      <ul className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
        {CASOS.map((c) => (
          <li key={c.t}>
            <Link
              href={c.h}
              className="group flex h-full flex-col justify-between gap-6 bg-black p-5 transition-all hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
            >
              <div>
                <p className="text-[14px] font-medium leading-snug text-white">
                  {c.t}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                  {c.d}
                </p>
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/30 transition-colors group-hover:text-emerald-300">
                ver caso
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
