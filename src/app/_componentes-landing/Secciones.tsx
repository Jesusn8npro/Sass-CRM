import Link from "next/link";

// ============================================================
// HERO — editorial, con mockup desbordando
// ============================================================
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      {/* Atmósfera: glow + grid + scan */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.18),transparent_60%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 30%, black 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Beta abierta · cupos limitados
        </div>

        <h1 className="max-w-[18ch] text-[44px] leading-[1.02] tracking-[-0.025em] text-white md:text-[88px] md:leading-[0.96]">
          Tu vendedor de WhatsApp{" "}
          <span className="font-display italic text-emerald-300">nunca</span>{" "}
          duerme.
        </h1>

        <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-white/55 md:text-base">
          Una IA que responde, agenda, llama y cierra ventas en WhatsApp —
          mientras vos ganás horas. Captación de leads, fotos de producto
          generadas, voz clonada y panel multi-cuenta. Todo operado desde
          un único lugar.
        </p>

        <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-[0_0_44px_-8px_rgba(255,255,255,0.4)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_60px_-8px_rgba(52,211,153,0.6)]"
          >
            Crear cuenta gratis
            <span className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="#como-funciona"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
          >
            Ver cómo opera
          </Link>
          <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 sm:inline">
            sin tarjeta · setup ≤ 2min
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
      <div className="absolute -inset-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_60%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-black/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
          <span className="ml-3 font-mono text-[10px] tracking-wide text-white/30">
            sass-crm.app/cuentas/joyería
          </span>
        </div>
        <div className="grid grid-cols-12 text-left">
          <aside className="col-span-4 border-r border-white/[0.06] bg-white/[0.02] p-4 md:col-span-3">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">Cuentas</p>
            <FilaSidebar inicial="MJ" nombre="Mi Joyería" tel="+54 11 5555-1234" activa />
            <FilaSidebar inicial="OD" nombre="Odontología Plus" tel="+57 300 222-4444" />
            <FilaSidebar inicial="CR" nombre="Carnicería del Sur" tel="+52 81 8888-1111" />
          </aside>
          <div className="col-span-8 p-5 md:col-span-9">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-[10px] font-semibold text-emerald-300">AC</div>
                <div>
                  <div className="text-[13px] font-medium text-white">Ana Cordero</div>
                  <div className="font-mono text-[10px] text-white/40">+54 9 11 4444-3333 · MODO IA</div>
                </div>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">interesado</span>
            </div>
            <div className="space-y-1.5">
              <Burbuja lado="izq">Vi el anillo de oro 18k, ¿cuánto sale?</Burbuja>
              <Burbuja lado="der">¡Hola Ana! Sale $185.000. Tenemos 3 medidas. ¿Querés ver fotos?</Burbuja>
              <Burbuja lado="izq">Sí, y métodos de pago.</Burbuja>
              <Burbuja lado="der" tipo="imagen">📷 producto.jpg</Burbuja>
              <Burbuja lado="der">Transferencia (5% off), MercadoPago en 12 cuotas y efectivo. ¿Te paso turno?</Burbuja>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaSidebar({ inicial, nombre, tel, activa }: { inicial: string; nombre: string; tel: string; activa?: boolean }) {
  return (
    <div className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 ${activa ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
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

function Burbuja({ lado, tipo, children }: { lado: "izq" | "der"; tipo?: "imagen"; children: React.ReactNode }) {
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

// ============================================================
// MÉTRICAS — terminal-style ticker
// ============================================================
const METRICAS = [
  { v: "24/7", l: "uptime real" },
  { v: "<5s", l: "respuesta promedio" },
  { v: "∞", l: "conversaciones simultáneas" },
  { v: "0%", l: "comisión por venta" },
];

export function Metricas() {
  return (
    <section className="border-b border-white/[0.06] bg-black">
      <div className="mx-auto max-w-6xl px-6 py-7">
        <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-4">
          {METRICAS.map((m) => (
            <div key={m.l} className="flex flex-col items-start gap-1 bg-black px-5 py-5">
              <span className="font-display text-4xl tracking-tight text-white md:text-5xl">{m.v}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{m.l}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CÓMO FUNCIONA — tres pasos, índice tipográfico
// ============================================================
const PASOS = [
  { n: "01", t: "Conectá tu WhatsApp", d: "QR como WhatsApp Web. Tu número queda enlazado al panel." },
  { n: "02", t: "Cargá tu negocio", d: "Subís catálogo, contás cómo respondés. La IA aprende tu tono." },
  { n: "03", t: "Dejá que venda", d: "La IA responde, agenda, captura datos y los lleva al pipeline." },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-14 max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// operación</p>
        <h2 className="text-4xl tracking-[-0.02em] text-white md:text-5xl">
          De cero a vendiendo en{" "}
          <span className="font-display italic text-white/70">tres pasos</span>.
        </h2>
      </div>
      <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
        {PASOS.map((p) => (
          <div key={p.n} className="group relative flex flex-col gap-4 bg-black p-7 transition-colors hover:bg-white/[0.02]">
            <span className="font-display text-7xl leading-none text-emerald-400/80">{p.n}</span>
            <h3 className="text-lg font-medium text-white">{p.t}</h3>
            <p className="text-sm leading-relaxed text-white/50">{p.d}</p>
            <span className="absolute right-6 top-6 h-px w-8 bg-emerald-400/40" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// FUNCIONES — 6 destacadas + tira de "incluye también"
// ============================================================
const FUNCIONES_DESTACADAS = [
  { n: "01", t: "Captación de leads con IA", d: "Buscá restaurantes en Bogotá, abogados en CDMX. Te llegan con teléfono, email y web — listos para escribir.", tag: "nuevo" },
  { n: "02", t: "Estudio de imágenes IA", d: "Subís foto del producto, elegís preset (fondo blanco, lifestyle, premium). La IA devuelve la versión profesional.", tag: "nuevo" },
  { n: "03", t: "Configurás conversando", d: "Sin formularios. Charlás con la IA y ella arma el agente: nombre, tono, bienvenida, contexto.", tag: "nuevo" },
  { n: "04", t: "IA multimodal", d: "GPT-4o ve imágenes, escucha audios, responde en texto y voz. Una sola conversación natural." },
  { n: "05", t: "Llamadas con voz clonada", d: "Tu agente llama leads con tu voz clonada (ElevenLabs + Vapi). El cliente piensa que sos vos." },
  { n: "06", t: "Pipeline Kanban", d: "Drag & drop entre etapas. Cada conversación es una tarjeta con todo el contexto." },
];

const FUNCIONES_EXTRA = [
  "Catálogo con stock y precio",
  "Agenda con recordatorios",
  "Sistema de créditos pay-as-you-go",
  "Multi-cuenta de WhatsApp",
  "Captura automática de email/teléfono",
  "Anti-ban con jitter humano",
];

export function Funciones() {
  return (
    <section id="funciones" className="border-y border-white/[0.06] bg-[#080808]">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// stack</p>
            <h2 className="text-4xl tracking-[-0.02em] text-white md:text-5xl">
              Todo lo que tu negocio{" "}
              <span className="font-display italic text-white/70">necesita</span>{" "}
              para vender en WhatsApp.
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
              className="group relative flex flex-col gap-3 bg-black p-7 transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">{f.n}</span>
                {f.tag && (
                  <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-fuchsia-300">
                    {f.tag}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-medium leading-snug text-white">{f.t}</h3>
              <p className="text-sm leading-relaxed text-white/50">{f.d}</p>
            </article>
          ))}
        </div>

        <div className="mt-px flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.06] bg-black px-7 py-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            incluye también
          </span>
          {FUNCIONES_EXTRA.map((e) => (
            <span key={e} className="text-[12px] text-white/60">
              <span className="mr-1.5 text-emerald-400">+</span>
              {e}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// CASOS DE USO — chips horizontales
// ============================================================
const CASOS = [
  "E-commerce / Joyería",
  "Odontología y salud",
  "Inmobiliarias",
  "Restaurantes / Delivery",
  "Cursos online & coaching",
  "Estética y peluquería",
  "Concesionarias y autos",
  "Gimnasios y bienestar",
  "Servicio técnico",
];

export function CasosDeUso() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-12 max-w-2xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">// industrias</p>
        <h2 className="text-4xl tracking-[-0.02em] text-white md:text-5xl">
          Si tus clientes te escriben por WhatsApp,{" "}
          <span className="font-display italic text-white/70">acá los atendés</span>.
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {CASOS.map((c) => (
          <span
            key={c}
            className="rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] text-white/75 transition-all hover:border-emerald-400/40 hover:bg-emerald-400/[0.04] hover:text-white"
          >
            {c}
          </span>
        ))}
      </div>
    </section>
  );
}
