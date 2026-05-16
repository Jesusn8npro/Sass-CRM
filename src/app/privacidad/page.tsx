import type { Metadata } from "next";
import { Navegacion, PieDePagina } from "@/app/_componentes-landing/Layout";

export const metadata: Metadata = {
  title: "Política de Privacidad — Sass-CRM",
  description:
    "Cómo Sass-CRM recolecta, usa, comparte y protege los datos personales de sus usuarios.",
};

const SUBPROCESADORES = [
  {
    n: "OpenAI",
    p: "Procesamiento del agente de IA (LLM).",
    href: "https://openai.com/policies/privacy-policy",
  },
  {
    n: "ElevenLabs",
    p: "Síntesis de voz / voz clonada.",
    href: "https://elevenlabs.io/privacy",
  },
  {
    n: "Vapi",
    p: "Llamadas salientes con IA.",
    href: "https://vapi.ai/privacy",
  },
  {
    n: "Apify",
    p: "Captación de leads desde fuentes públicas.",
    href: "https://apify.com/privacy-policy",
  },
  {
    n: "Supabase",
    p: "Base de datos, autenticación y almacenamiento de archivos.",
    href: "https://supabase.com/privacy",
  },
  {
    n: "PayPal",
    p: "Procesamiento de pagos y suscripciones.",
    href: "https://www.paypal.com/legalhub/privacy-full",
  },
  {
    n: "Resend",
    p: "Envío de emails transaccionales.",
    href: "https://resend.com/legal/privacy-policy",
  },
];

const SECCIONES = [
  {
    n: "01",
    t: "Datos que recolectamos",
    clave: "recopilacion",
    body: (
      <>
        <p>
          Recolectamos solo lo necesario para que el servicio funcione:
        </p>
        <ul>
          <li>
            <strong>Datos de cuenta:</strong> nombre, email y contraseña
            (almacenada como hash).
          </li>
          <li>
            <strong>Datos de WhatsApp conectado:</strong> número de teléfono,
            sesión cifrada de Baileys, contactos sincronizados.
          </li>
          <li>
            <strong>Conversaciones:</strong> mensajes entrantes y salientes
            procesados por el agente, incluyendo audio, imágenes y archivos
            que pasen por el chat.
          </li>
          <li>
            <strong>Datos de configuración:</strong> prompt del agente,
            catálogo de productos, calendario, integraciones.
          </li>
          <li>
            <strong>Datos de pago:</strong> los procesa PayPal directamente.
            Nosotros guardamos el ID de suscripción y el historial de
            facturación, <strong>nunca el número de tarjeta</strong>.
          </li>
          <li>
            <strong>Datos técnicos:</strong> IP, user-agent, logs de
            actividad, errores y métricas de uso.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: "02",
    t: "Por qué los recolectamos",
    clave: "finalidad",
    body: (
      <>
        <ul>
          <li>Para prestar el servicio (operar el agente, conectar el WhatsApp, ejecutar las llamadas).</li>
          <li>Para facturar y cobrar tu suscripción.</li>
          <li>Para darte soporte cuando lo necesites.</li>
          <li>Para detectar abusos, fraude y violaciones a los términos.</li>
          <li>Para mejorar el producto (de forma agregada y anónima, no leemos conversaciones individuales para entrenar modelos).</li>
        </ul>
      </>
    ),
  },
  {
    n: "03",
    t: "Con quién compartimos",
    clave: "compartir",
    body: (
      <>
        <p>
          No vendemos tus datos. Los compartimos únicamente con los
          subprocesadores que hacen funcionar el servicio. Cada uno opera
          bajo su propia política de privacidad:
        </p>
        <ul className="!ml-0 !list-none !space-y-2">
          {SUBPROCESADORES.map((sp) => (
            <li key={sp.n} className="flex items-baseline gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                /
              </span>
              <span>
                <a
                  href={sp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] uppercase tracking-wide text-white hover:text-emerald-300"
                >
                  {sp.n}
                </a>
                <span className="ml-2 text-white/55">— {sp.p}</span>
              </span>
            </li>
          ))}
        </ul>
        <p>
          También podemos divulgar datos cuando una autoridad competente lo
          requiera por orden legal vinculante.
        </p>
      </>
    ),
  },
  {
    n: "04",
    t: "Tiempo de retención",
    clave: "retencion",
    body: (
      <>
        <ul>
          <li>
            <strong>Conversaciones y datos del agente:</strong> mientras tu
            cuenta esté activa + <strong>90 días</strong> después de la baja,
            por si querés reactivar.
          </li>
          <li>
            <strong>Datos de cuenta:</strong> hasta que pidas la eliminación.
          </li>
          <li>
            <strong>Logs de pagos y facturación:</strong>{" "}
            <strong>5 años</strong> a partir de cada operación, por
            obligación fiscal de la jurisdicción.
          </li>
          <li>
            <strong>Logs técnicos y de seguridad:</strong> hasta 12 meses.
          </li>
        </ul>
        <p>
          Pasados estos plazos los datos se eliminan o anonimizan de forma
          irreversible.
        </p>
      </>
    ),
  },
  {
    n: "05",
    t: "Derechos del titular",
    clave: "derechos",
    body: (
      <>
        <p>
          De acuerdo con la legislación aplicable (LGPD, Habeas Data, GDPR y
          equivalentes), tenés derecho a:
        </p>
        <ul>
          <li>Acceder a los datos personales que tenemos sobre vos.</li>
          <li>Rectificarlos si están incompletos o desactualizados.</li>
          <li>Solicitar su eliminación (derecho al olvido).</li>
          <li>Solicitar la portabilidad en un formato estructurado.</li>
          <li>Oponerte al tratamiento o limitarlo.</li>
          <li>Retirar el consentimiento en cualquier momento.</li>
        </ul>
        <p>
          Para ejercer estos derechos, escribinos a{" "}
          <a
            href="mailto:privacidad@sass-crm.com"
            className="font-mono text-emerald-300 underline-offset-4 hover:underline"
          >
            privacidad@sass-crm.com
          </a>
          . Respondemos en un plazo máximo de 15 días hábiles.
        </p>
      </>
    ),
  },
  {
    n: "06",
    t: "Cookies",
    clave: "cookies",
    body: (
      <>
        <p>
          Usamos cookies de sesión de Supabase Auth para mantenerte logueado
          y para proteger contra CSRF. No usamos trackers de terceros, no
          tenemos píxeles publicitarios, no vendemos perfiles de navegación.
        </p>
        <p>
          Si bloqueás las cookies, partes del panel pueden dejar de funcionar.
        </p>
      </>
    ),
  },
  {
    n: "07",
    t: "Transferencias internacionales",
    clave: "transferencias",
    body: (
      <>
        <p>
          Sass-CRM opera con servidores en LATAM, pero algunos
          subprocesadores (OpenAI, ElevenLabs, Vapi, Resend) procesan datos
          en Estados Unidos o la Unión Europea.
        </p>
        <p>
          Estas transferencias se hacen bajo <strong>Cláusulas Contractuales
          Estándar</strong> u otros mecanismos legales equivalentes que
          garantizan un nivel de protección adecuado al de tu país de
          residencia.
        </p>
      </>
    ),
  },
  {
    n: "08",
    t: "Menores de edad",
    clave: "menores",
    body: (
      <>
        <p>
          Sass-CRM no está dirigido a menores de 18 años y no recolectamos
          datos de menores de manera consciente. Si detectás que un menor
          creó una cuenta, escribinos a{" "}
          <a
            href="mailto:privacidad@sass-crm.com"
            className="font-mono text-emerald-300 underline-offset-4 hover:underline"
          >
            privacidad@sass-crm.com
          </a>{" "}
          y la eliminamos.
        </p>
      </>
    ),
  },
  {
    n: "09",
    t: "Seguridad",
    clave: "seguridad",
    body: (
      <>
        <ul>
          <li>
            <strong>Encriptación en tránsito:</strong> todo el tráfico viaja
            sobre TLS 1.2+.
          </li>
          <li>
            <strong>Encriptación en reposo:</strong> la base de datos
            Postgres y los archivos en Supabase Storage están cifrados.
          </li>
          <li>
            <strong>Aislamiento por tenant:</strong> aplicamos Row Level
            Security en Postgres. Cada usuario solo puede acceder a sus
            propios datos.
          </li>
          <li>
            <strong>Sesiones de WhatsApp:</strong> se guardan cifradas;
            ninguna persona del equipo puede leer tus mensajes en texto plano
            sin autorización explícita tuya para soporte.
          </li>
          <li>
            <strong>Backups:</strong> diarios, retenidos 30 días.
          </li>
        </ul>
        <p>
          Ningún sistema es 100% inviolable. Si detectamos un incidente que
          afecte tus datos, te avisaremos en un plazo máximo de 72 horas.
        </p>
      </>
    ),
  },
  {
    n: "10",
    t: "Cambios a esta política",
    clave: "cambios",
    body: (
      <>
        <p>
          Si modificamos esta política, te avisaremos por email a la
          dirección registrada en tu cuenta y publicaremos la versión nueva
          con su fecha. Los cambios sustanciales se notifican con al menos 30
          días de anticipación.
        </p>
      </>
    ),
  },
  {
    n: "11",
    t: "Contacto · DPO",
    clave: "contacto",
    body: (
      <>
        <p>
          Para cualquier asunto relacionado con privacidad, protección de
          datos o ejercicio de derechos, escribinos a{" "}
          <a
            href="mailto:privacidad@sass-crm.com"
            className="font-mono text-emerald-300 underline-offset-4 hover:underline"
          >
            privacidad@sass-crm.com
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function PaginaPrivacidad() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navegacion />

      {/* Page header */}
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
        <p className="mb-3 inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Última actualización: 2026-05-04
        </p>
        <h1 className="font-bold tracking-tight text-4xl text-zinc-100 md:text-5xl">
          Política de Privacidad
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
          Qué datos guardamos, por qué, con quién los compartimos y cómo los
          protegemos. Sin letra chica.
        </p>
      </div>

      {/* 2-column layout */}
      <div className="mx-auto max-w-6xl px-6 pb-24 lg:flex lg:gap-16">

        {/* LEFT sidebar — sticky anchor nav */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-24 space-y-1">
            <a
              href="#"
              className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600 hover:text-emerald-300 transition-colors"
            >
              ↑ Volver al inicio
            </a>
            {SECCIONES.map((s) => (
              <a
                key={s.clave}
                href={`#${s.clave}`}
                className="group flex items-center gap-2 border-l-2 border-transparent pl-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
              >
                <span className="text-zinc-700 group-hover:text-emerald-500">{s.n}</span>
                <span className="truncate">{s.t}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* RIGHT — main content */}
        <main className="min-w-0 flex-1">
          {SECCIONES.map((s) => (
            <section
              key={s.n}
              id={s.clave}
              className="scroll-mt-24 border-b border-white/[0.04] py-8 last:border-b-0"
            >
              <h2 className="text-lg font-bold text-zinc-100 mb-3">
                {s.t}
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-zinc-400 [&_a]:text-emerald-300 [&_li]:pl-1 [&_strong]:text-zinc-100 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                {s.body}
              </div>
            </section>
          ))}

          <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            fin del documento · <span className="text-emerald-400">v1.0</span>
          </div>
        </main>
      </div>

      <PieDePagina />
    </div>
  );
}
