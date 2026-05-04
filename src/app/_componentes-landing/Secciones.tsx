import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fondo con grid sutil + glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-4 pt-16 pb-20 text-center md:px-6 md:pt-24 md:pb-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Beta abierta — invitaciones limitadas
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
          Tu agente de WhatsApp
          <br />
          <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
            que vende mientras dormís
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 md:text-lg dark:text-zinc-400">
          IA que responde, agenda, llama y cierra ventas en WhatsApp 24/7. Y
          ahora también <strong>busca clientes nuevos</strong>, <strong>genera
          fotos profesionales</strong> de tus productos y se <strong>configura
          conversando con vos</strong>. Todo en un panel.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="group flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-500/40"
          >
            Crear cuenta gratis
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link
            href="#como-funciona"
            className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Ver cómo funciona
          </Link>
        </div>

        <p className="mt-5 text-xs text-zinc-500">
          Sin tarjeta de crédito · Setup en 2 minutos · Soporte por WhatsApp
        </p>

        {/* Mockup del panel */}
        <div className="mt-16 md:mt-20">
          <MockupPanel />
        </div>
      </div>
    </section>
  );
}

export function MockupPanel() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 opacity-50 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Barra superior estilo macOS */}
        <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs font-mono text-zinc-500">app.sass-crm.com/cuentas/mi-negocio</span>
        </div>
        {/* "Pantalla" del panel */}
        <div className="grid grid-cols-12 gap-0 text-left">
          {/* Sidebar */}
          <div className="col-span-3 border-r border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="mb-3 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
              Cuentas
            </div>
            <FilaSidebar inicial="MJ" nombre="Mi Joyería" telefono="+54 11 5555-1234" activa />
            <FilaSidebar inicial="OD" nombre="Odontología Plus" telefono="+57 300 222-4444" />
            <FilaSidebar inicial="CR" nombre="Carniceria del Sur" telefono="+52 81 8888-1111" />
          </div>
          {/* Conversación */}
          <div className="col-span-9 p-4">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  AC
                </div>
                <div>
                  <div className="text-sm font-semibold">Ana Cordero</div>
                  <div className="text-[10px] text-zinc-500">+54 9 11 4444-3333 · Modo IA</div>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                Interesado
              </span>
            </div>
            <div className="space-y-2">
              <Burbuja lado="izq">Hola! Vi tu publicación del anillo de oro 18k, ¿cuánto sale?</Burbuja>
              <Burbuja lado="der">¡Hola Ana! El anillo Solitario 18k sale $185.000. Tenemos 3 medidas disponibles. ¿Querés que te muestre fotos?</Burbuja>
              <Burbuja lado="izq">Si dale, y si me podés decir métodos de pago</Burbuja>
              <Burbuja lado="der" tipo="imagen">📷 [imagen del producto]</Burbuja>
              <Burbuja lado="der">
                Aceptamos transferencia (5% off), MercadoPago en 3/6/12 cuotas y efectivo en local. ¿Te paso turno para que lo veas?
              </Burbuja>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FilaSidebar({
  inicial,
  nombre,
  telefono,
  activa,
}: {
  inicial: string;
  nombre: string;
  telefono: string;
  activa?: boolean;
}) {
  return (
    <div
      className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        activa
          ? "bg-white shadow-sm dark:bg-zinc-800"
          : "hover:bg-white/60 dark:hover:bg-zinc-800/60"
      }`}
    >
      <div className="relative flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
        {inicial}
        <span className="absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold">{nombre}</div>
        <div className="truncate font-mono text-[8px] text-zinc-500">{telefono}</div>
      </div>
    </div>
  );
}

export function Burbuja({
  lado,
  tipo,
  children,
}: {
  lado: "izq" | "der";
  tipo?: "imagen";
  children: React.ReactNode;
}) {
  const esIzq = lado === "izq";
  return (
    <div className={`flex ${esIzq ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-snug shadow-sm ${
          esIzq
            ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            : tipo === "imagen"
            ? "bg-emerald-500/20 text-emerald-800 italic dark:text-emerald-200"
            : "bg-emerald-500 text-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================
// MÉTRICAS (prueba social)
// ============================================================
export function Metricas() {
  return (
    <section className="border-y border-zinc-200 bg-zinc-50/50 py-12 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Lo que estás dejando de ganar mientras dormís
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metrica numero="24/7" texto="Disponibilidad real, sin descansos" />
          <Metrica numero="< 5s" texto="Respuesta promedio del bot" />
          <Metrica numero="∞" texto="Conversaciones simultáneas" />
          <Metrica numero="0%" texto="Comisión sobre tus ventas" />
        </div>
      </div>
    </section>
  );
}

export function Metrica({ numero, texto }: { numero: string; texto: string }) {
  return (
    <div className="text-center">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
        {numero}
      </div>
      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{texto}</div>
    </div>
  );
}

// ============================================================
// CÓMO FUNCIONA
// ============================================================
export function ComoFunciona() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          De cero a vendiendo en 3 pasos
        </h2>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
          Sin código, sin instalaciones, sin dolor de cabeza. Si sabés usar
          WhatsApp, sabés usar Sass-CRM.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
        <Paso
          numero="01"
          titulo="Conectá tu WhatsApp"
          descripcion="Escaneás un QR como cuando entrás a WhatsApp Web. Listo. Tu número queda enlazado al panel."
        />
        <Paso
          numero="02"
          titulo="Cargá tu negocio"
          descripcion="Subís tu catálogo, le contás a la IA cómo respondés, qué productos vendés y a qué precios. La IA aprende tu tono."
        />
        <Paso
          numero="03"
          titulo="Dejá que venda"
          descripcion="Cuando un cliente escribe, la IA responde, agenda visitas, captura el email/teléfono y los lleva al pipeline. Vos cerrás cuando hace falta."
        />
      </div>
    </section>
  );
}

export function Paso({
  numero,
  titulo,
  descripcion,
}: {
  numero: string;
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-emerald-500/30 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-mono text-sm font-bold text-white">
        {numero}
      </div>
      <h3 className="text-lg font-semibold">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {descripcion}
      </p>
    </div>
  );
}

// ============================================================
// FUNCIONES (grid 6)
// ============================================================
export function Funciones() {
  return (
    <section id="funciones" className="border-y border-zinc-200 bg-zinc-50/50 py-20 md:py-28 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Todo lo que necesita tu negocio para vender en WhatsApp
          </h2>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
            Sin Zapier, sin n8n, sin armar nada. Todo está integrado.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
          <TarjetaFuncion
            icono="🔍"
            titulo="Captación de leads con IA"
            descripcion="Buscá restaurantes en Bogotá, abogados en CDMX, lo que quieras. Te trae nombre, teléfono, email y web — listo para escribirles."
            destacada
          />
          <TarjetaFuncion
            icono="🎨"
            titulo="Estudio de imágenes IA"
            descripcion="Subís foto de tu producto, elegís un preset (fondo blanco, lifestyle, premium) y la IA te genera la versión profesional."
            destacada
          />
          <TarjetaFuncion
            icono="💬"
            titulo="Configurás conversando"
            descripcion="Olvidate de formularios largos. Charlás con la IA y ella te arma el agente: nombre, tono, mensaje de bienvenida, contexto."
            destacada
          />
          <TarjetaFuncion
            icono="🤖"
            titulo="IA multimodal"
            descripcion="GPT-4o ve imágenes, escucha audios, responde en texto y voz. Mezcla todo en una conversación natural."
          />
          <TarjetaFuncion
            icono="📞"
            titulo="Llamadas con voz clonada"
            descripcion="Tu agente llama a leads con tu voz clonada (ElevenLabs + Vapi). El cliente cree que sos vos."
          />
          <TarjetaFuncion
            icono="🗂"
            titulo="Pipeline Kanban"
            descripcion="Drag and drop entre etapas (Nuevo → Interesado → Cerrado). Cada conversación es una tarjeta."
          />
          <TarjetaFuncion
            icono="📦"
            titulo="Catálogo de productos"
            descripcion="Subís fotos y videos, definís stock y precio. La IA usa el catálogo para responder consultas."
          />
          <TarjetaFuncion
            icono="📅"
            titulo="Agenda con recordatorios"
            descripcion="La IA agenda citas. Una hora antes manda recordatorio automático. Cero no-show."
          />
          <TarjetaFuncion
            icono="💳"
            titulo="Sistema de créditos"
            descripcion="Pay-as-you-go. Cada lead, cada imagen, cada audio descuenta créditos. Sin sorpresas en la factura."
          />
          <TarjetaFuncion
            icono="💼"
            titulo="Multi-cuenta de WhatsApp"
            descripcion="Conectás N números desde el mismo panel. Cada uno con su prompt, voz y catálogo."
          />
          <TarjetaFuncion
            icono="📧"
            titulo="Captura automática"
            descripcion="La IA detecta emails y teléfonos en los mensajes y los guarda en tu CRM sin que muevas un dedo."
          />
          <TarjetaFuncion
            icono="🚫"
            titulo="Anti-ban WhatsApp"
            descripcion="Límites diarios, horarios humanos, jitter entre envíos. Diseñado para no quemar números."
          />
        </div>
      </div>
    </section>
  );
}

export function TarjetaFuncion({
  icono,
  titulo,
  descripcion,
  destacada = false,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  destacada?: boolean;
}) {
  return (
    <div
      className={`group relative rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        destacada
          ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-white to-white shadow-sm hover:border-emerald-500/60 dark:from-emerald-500/10 dark:via-zinc-950 dark:to-zinc-950"
          : "border-zinc-200 bg-white hover:border-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      {destacada && (
        <span className="absolute -top-2 right-4 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          Nuevo
        </span>
      )}
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-2xl ring-1 ring-emerald-500/20">
        {icono}
      </div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {descripcion}
      </p>
    </div>
  );
}

// ============================================================
// CASOS DE USO
// ============================================================
export function CasosDeUso() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Funciona para cualquier negocio que viva de WhatsApp
        </h2>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
          Si los clientes te escriben por WhatsApp, Sass-CRM les responde.
        </p>
      </div>
      <div className="mt-12 grid gap-3 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
        <CasoUso emoji="💎" titulo="E-commerce / Joyería" />
        <CasoUso emoji="🦷" titulo="Odontología y salud" />
        <CasoUso emoji="🏠" titulo="Inmobiliarias" />
        <CasoUso emoji="🍔" titulo="Restaurantes / Delivery" />
        <CasoUso emoji="🎓" titulo="Cursos online y coaching" />
        <CasoUso emoji="💇" titulo="Estética y peluquería" />
        <CasoUso emoji="🚗" titulo="Concesionarias y autos" />
        <CasoUso emoji="🏋️" titulo="Gimnasios y bienestar" />
        <CasoUso emoji="📱" titulo="Servicio técnico" />
      </div>
    </section>
  );
}

export function CasoUso({ emoji, titulo }: { emoji: string; titulo: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-medium">{titulo}</span>
    </div>
  );
}
