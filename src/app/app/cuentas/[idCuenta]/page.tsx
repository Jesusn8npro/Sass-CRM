import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import {
  listarCitasDeCuenta,
  listarConversaciones,
  obtenerCuenta,
  obtenerMetricas,
} from "@/lib/baseDatos";
import { obtenerSaldo } from "@/lib/db/creditos";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { EstadoVacio } from "@/components/ui/EstadoVacio";

const MODULOS = [
  {
    seccion: "Principal",
    items: [
      { etiqueta: "Conversaciones", descripcion: "Chats activos de WhatsApp", href: "conversaciones", emoji: "💬" },
      { etiqueta: "Clientes", descripcion: "Base de contactos", href: "clientes", emoji: "👥" },
      { etiqueta: "Reportes", descripcion: "Métricas y actividad", href: "dashboard", emoji: "📊" },
      { etiqueta: "Agenda", descripcion: "Citas y recordatorios", href: "agenda", emoji: "📅" },
      { etiqueta: "Plantillas", descripcion: "Mensajes predefinidos", href: "plantillas", emoji: "📝" },
    ],
  },
  {
    seccion: "Prospección automática",
    items: [
      { etiqueta: "Pipeline", descripcion: "Estado de los leads", href: "prospeccion", emoji: "🎯" },
      { etiqueta: "Llamadas", descripcion: "Historial con transcripciones", href: "prospeccion/llamadas", emoji: "📞" },
      { etiqueta: "Correos", descripcion: "Secuencias de cold email", href: "prospeccion/correos", emoji: "✉️" },
      { etiqueta: "Buscar leads", descripcion: "Encontrar negocios en Google Maps", href: "leads", emoji: "🔍" },
    ],
  },
  {
    seccion: "Ventas",
    items: [
      { etiqueta: "Llamadas Vapi", descripcion: "Llamadas IA salientes", href: "llamadas", emoji: "📱" },
      { etiqueta: "Productos", descripcion: "Catálogo y precios", href: "productos", emoji: "🛍️" },
      { etiqueta: "Seguimientos", descripcion: "Tareas comerciales", href: "seguimientos", emoji: "✅" },
      { etiqueta: "Inversiones", descripcion: "Ingresos y gastos", href: "inversiones", emoji: "💰" },
    ],
  },
  {
    seccion: "Configuración",
    items: [
      { etiqueta: "Agente IA", descripcion: "Configurar el asistente", href: "configuracion", emoji: "🤖" },
      { etiqueta: "WhatsApp Web", descripcion: "Conectar WhatsApp personal", href: "whatsapp", emoji: "📲" },
      { etiqueta: "WhatsApp Business", descripcion: "API oficial de Meta", href: "whatsapp-business", emoji: "🏢" },
      { etiqueta: "Conocimiento", descripcion: "Base de conocimiento RAG", href: "conocimiento", emoji: "📚" },
      { etiqueta: "Funnel", descripcion: "Etapas del embudo", href: "pipeline", emoji: "🔄" },
      { etiqueta: "Webhooks", descripcion: "Integraciones externas", href: "webhooks", emoji: "🔗" },
    ],
  },
  {
    seccion: "IA · Crecimiento",
    items: [
      { etiqueta: "Estudio imágenes", descripcion: "Generar imágenes con IA", href: "estudio", emoji: "🎨" },
      { etiqueta: "Créditos", descripcion: "Saldo y consumo", href: "creditos", emoji: "⚡" },
    ],
  },
];

const TF_HORA = new Intl.DateTimeFormat("es-419", {
  hour: "2-digit",
  minute: "2-digit",
});
const TF_FECHA = new Intl.DateTimeFormat("es-419", {
  day: "numeric",
  month: "short",
});

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function nombreDesdeEmail(email: string): string {
  const sin = email.split("@")[0] ?? "";
  if (!sin) return "";
  const base = sin.split(/[.\-_]/)[0] ?? sin;
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min}m`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.round(horas / 24);
  if (dias < 7) return `hace ${dias}d`;
  return TF_FECHA.format(new Date(iso));
}

export default async function PaginaInicio({
  params,
}: {
  params: Promise<{ idCuenta: string }>;
}) {
  const { idCuenta } = await params;
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app");

  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) redirect("/app");

  const [metricas, conversaciones, citas, saldo] = await Promise.all([
    obtenerMetricas(idCuenta),
    listarConversaciones(idCuenta),
    listarCitasDeCuenta(idCuenta),
    obtenerSaldo(idCuenta).catch(() => null),
  ]);

  const nombre = nombreDesdeEmail(auth.email ?? "");
  const ahora = Date.now();
  const citasProximas = citas
    .filter(
      (c) =>
        new Date(c.fecha_hora).getTime() > ahora &&
        (c.estado === "agendada" || c.estado === "confirmada"),
    )
    .slice(0, 4);
  const ultimasConversaciones = conversaciones.slice(0, 5);

  const estado = cuenta.estado;
  const etiquetaEstado =
    estado === "conectado"
      ? { variante: "exito" as const, texto: "Conectado" }
      : estado === "qr"
      ? { variante: "aviso" as const, texto: "Esperando QR" }
      : { variante: "neutral" as const, texto: "Desconectado" };

  return (
    <div className="min-h-screen bg-superficie-suave p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header personalizado */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-texto-tenue">
              {saludo()}
              {nombre && `, ${nombre}`}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-texto">
              {cuenta.etiqueta}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Etiqueta variante={etiquetaEstado.variante} punto>
                {etiquetaEstado.texto}
              </Etiqueta>
              {cuenta.telefono && (
                <Etiqueta variante="contorno">
                  +{cuenta.telefono}
                </Etiqueta>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/app/cuenta/conversaciones`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-marca-400 px-4 text-sm font-semibold text-black shadow-[var(--shadow-glow-marca-sm)] transition-all hover:bg-marca-300 hover:shadow-[var(--shadow-glow-marca)]"
            >
              <span>Ir a conversaciones</span>
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={`/app/cuenta/dashboard`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-borde bg-superficie px-4 text-sm font-medium text-texto transition-colors hover:border-borde-fuerte"
            >
              Ver reportes
            </Link>
          </div>
        </header>

        {/* KPIs personalizados */}
        <section
          aria-label="Resumen de tu cuenta"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <KpiTarjeta
            titulo="Mensajes hoy"
            valor={metricas.mensajes_hoy.toLocaleString("es-419")}
            detalle={`${metricas.mensajes_ultimos_7d.toLocaleString("es-419")} en 7 días`}
            href="/app/cuenta/dashboard"
            tono="marca"
          />
          <KpiTarjeta
            titulo="Necesitan atención"
            valor={metricas.conversaciones_necesitan_humano.toString()}
            detalle={
              metricas.conversaciones_necesitan_humano > 0
                ? "Conversaciones esperándote"
                : "Todo al día"
            }
            href="/app/cuenta/conversaciones"
            tono={metricas.conversaciones_necesitan_humano > 0 ? "aviso" : "neutral"}
          />
          <KpiTarjeta
            titulo="Citas próximas (7d)"
            valor={metricas.citas_proximas_7d.toString()}
            detalle={`${metricas.citas_hoy} hoy`}
            href="/app/cuenta/agenda"
            tono="info"
          />
          <KpiTarjeta
            titulo="Créditos disponibles"
            valor={saldo ? saldo.saldo_actual.toLocaleString("es-419") : "—"}
            detalle={
              saldo
                ? saldo.saldo_actual < 100
                  ? "Saldo bajo"
                  : "Listo para operar"
                : "Sin inicializar"
            }
            href="/app/cuenta/creditos"
            tono={saldo && saldo.saldo_actual < 100 ? "peligro" : "exito"}
          />
        </section>

        {/* Actividad reciente + próximas citas */}
        <section className="grid gap-4 lg:grid-cols-5">
          <Tarjeta className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-texto">
                  Últimas conversaciones
                </h2>
                <p className="mt-0.5 text-xs text-texto-suave">
                  Lo que está pasando en tu WhatsApp ahora
                </p>
              </div>
              <Link
                href="/app/cuenta/conversaciones"
                className="text-xs font-medium text-marca-600 hover:text-marca-500 dark:text-marca-300"
              >
                Ver todas →
              </Link>
            </div>

            {ultimasConversaciones.length === 0 ? (
              <EstadoVacio
                titulo="Aún no hay conversaciones"
                descripcion="Cuando empiecen a llegar mensajes, vas a verlos acá."
                tamano="sm"
              />
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {ultimasConversaciones.map((c) => {
                  const nombreContacto =
                    c.datos_capturados?.nombre?.trim() ||
                    c.nombre ||
                    `+${c.telefono}`;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/app/cuenta/conversaciones?id=${c.id}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-superficie-suave/60"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marca-500 to-teal-600 text-xs font-bold text-white">
                          {nombreContacto.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-texto">
                            {nombreContacto}
                          </p>
                          <p className="truncate text-xs text-texto-suave">
                            {c.vista_previa_ultimo_mensaje || "Sin mensajes aún"}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] text-texto-tenue">
                            {tiempoRelativo(c.ultimo_mensaje_en)}
                          </span>
                          {c.mensajes_nuevos > 0 && (
                            <span className="rounded-full bg-marca-500 px-1.5 py-px text-[10px] font-bold text-white">
                              {c.mensajes_nuevos}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-texto">
                  Próximas citas
                </h2>
                <p className="mt-0.5 text-xs text-texto-suave">
                  Lo que tenés agendado
                </p>
              </div>
              <Link
                href="/app/cuenta/agenda"
                className="text-xs font-medium text-marca-600 hover:text-marca-500 dark:text-marca-300"
              >
                Agenda →
              </Link>
            </div>

            {citasProximas.length === 0 ? (
              <EstadoVacio
                titulo="No hay citas"
                descripcion="Cuando agendes una, va a aparecer acá."
                tamano="sm"
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {citasProximas.map((c) => {
                  const fecha = new Date(c.fecha_hora);
                  const esHoy =
                    fecha.toDateString() === new Date().toDateString();
                  return (
                    <li
                      key={c.id}
                      className="flex items-start gap-3 rounded-xl border border-borde bg-superficie-suave/40 p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-marca-500/10 text-marca-700 dark:text-marca-300">
                        <span className="text-[9px] font-mono uppercase">
                          {fecha.toLocaleDateString("es-419", {
                            month: "short",
                          })}
                        </span>
                        <span className="text-sm font-bold leading-none">
                          {fecha.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-texto">
                          {c.cliente_nombre || "Cita"}
                          {c.tipo && (
                            <span className="ml-1 text-texto-suave">· {c.tipo}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-texto-suave">
                          {esHoy ? "Hoy" : TF_FECHA.format(fecha)} ·{" "}
                          {TF_HORA.format(fecha)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tarjeta>
        </section>

        {/* Atajos a todos los módulos */}
        <section aria-label="Módulos de la plataforma" className="space-y-6">
          <header>
            <h2 className="text-sm font-semibold tracking-tight text-texto">
              Todos los módulos
            </h2>
            <p className="mt-0.5 text-xs text-texto-suave">
              Atajos a cada parte de tu plataforma
            </p>
          </header>

          <div className="space-y-6">
            {MODULOS.map((grupo) => (
              <div key={grupo.seccion}>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-texto-tenue">
                  {grupo.seccion}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {grupo.items.map((item) => (
                    <Link
                      key={item.href}
                      href={`/app/cuenta/${item.href}`}
                      className="group flex items-center gap-3 rounded-xl border border-borde bg-superficie p-3 transition-all hover:-translate-y-0.5 hover:border-marca-500/40 hover:shadow-sm"
                    >
                      <span className="shrink-0 text-xl transition-transform group-hover:scale-110">
                        {item.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-texto">
                          {item.etiqueta}
                        </p>
                        <p className="truncate text-[10px] text-texto-tenue">
                          {item.descripcion}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiTarjeta({
  titulo,
  valor,
  detalle,
  href,
  tono,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  href: string;
  tono: "marca" | "exito" | "aviso" | "peligro" | "info" | "neutral";
}) {
  const tonos = {
    marca: "from-marca-500/[0.06] to-transparent border-marca-500/20",
    exito: "from-emerald-500/[0.06] to-transparent border-emerald-500/20",
    aviso: "from-amber-500/[0.06] to-transparent border-amber-500/20",
    peligro: "from-red-500/[0.06] to-transparent border-red-500/20",
    info: "from-sky-500/[0.06] to-transparent border-sky-500/20",
    neutral: "from-zinc-500/[0.04] to-transparent border-borde",
  } as const;

  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 rounded-2xl border bg-gradient-to-br p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${tonos[tono]}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-texto-suave">
        {titulo}
      </p>
      <p className="text-2xl font-bold tracking-tight text-texto">{valor}</p>
      <p className="text-[11px] text-texto-tenue">{detalle}</p>
    </Link>
  );
}
