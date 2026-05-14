"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const modulos = [
  {
    seccion: "Principal",
    items: [
      { etiqueta: "Conversaciones", descripcion: "Chats activos de WhatsApp", href: "conversaciones", emoji: "💬" },
      { etiqueta: "Clientes", descripcion: "Base de contactos y clientes", href: "clientes", emoji: "👥" },
      { etiqueta: "Reportes", descripcion: "Métricas y actividad", href: "dashboard", emoji: "📊" },
      { etiqueta: "Agenda", descripcion: "Citas y recordatorios", href: "agenda", emoji: "📅" },
      { etiqueta: "Plantillas", descripcion: "Mensajes predefinidos", href: "plantillas", emoji: "📝" },
    ],
  },
  {
    seccion: "Prospección Automática",
    items: [
      { etiqueta: "Pipeline", descripcion: "Estado de todos los leads en el pipeline", href: "prospeccion", emoji: "🎯" },
      { etiqueta: "Llamadas", descripcion: "Logs de llamadas con transcripciones", href: "prospeccion/llamadas", emoji: "📞" },
      { etiqueta: "Correos", descripcion: "Secuencia de 3 correos por lead", href: "prospeccion/correos", emoji: "✉️" },
      { etiqueta: "Buscar leads", descripcion: "Encontrar negocios en Google Maps", href: "leads", emoji: "🔍" },
    ],
  },
  {
    seccion: "Ventas",
    items: [
      { etiqueta: "Llamadas Vapi", descripcion: "Historial de llamadas IA", href: "llamadas", emoji: "📱" },
      { etiqueta: "Productos", descripcion: "Catálogo de productos y precios", href: "productos", emoji: "🛍️" },
      { etiqueta: "Seguimientos", descripcion: "Tareas de seguimiento comercial", href: "seguimientos", emoji: "✅" },
      { etiqueta: "Inversiones", descripcion: "Control de ingresos y gastos", href: "inversiones", emoji: "💰" },
    ],
  },
  {
    seccion: "Configuración",
    items: [
      { etiqueta: "Agente IA", descripcion: "Configurar el asistente virtual", href: "configuracion", emoji: "🤖" },
      { etiqueta: "WhatsApp Web", descripcion: "Conectar WhatsApp personal", href: "whatsapp", emoji: "📲" },
      { etiqueta: "WhatsApp Business", descripcion: "API oficial de WhatsApp", href: "whatsapp-business", emoji: "🏢" },
      { etiqueta: "Conocimiento", descripcion: "Base de conocimiento del agente", href: "conocimiento", emoji: "📚" },
      { etiqueta: "Funnel", descripcion: "Etapas del embudo de ventas", href: "pipeline", emoji: "🔄" },
      { etiqueta: "Webhooks", descripcion: "Integraciones externas", href: "webhooks", emoji: "🔗" },
    ],
  },
  {
    seccion: "IA · Crecimiento",
    items: [
      { etiqueta: "Estudio imágenes", descripcion: "Generar imágenes con IA", href: "estudio", emoji: "🎨" },
      { etiqueta: "Créditos", descripcion: "Saldo y consumo de créditos", href: "creditos", emoji: "⚡" },
    ],
  },
];

export default function PaginaInicio() {
  const params = useParams();
  const idCuenta = params.idCuenta as string;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Inicio
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Todos los módulos de tu plataforma en un solo lugar.
          </p>
        </div>

        <div className="space-y-8">
          {modulos.map((grupo) => (
            <div key={grupo.seccion}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {grupo.seccion}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {grupo.items.map((item) => (
                  <Link
                    key={item.href}
                    href={`/app/cuentas/${idCuenta}/${item.href}`}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-600"
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                        {item.etiqueta}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                        {item.descripcion}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
