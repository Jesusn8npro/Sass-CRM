import type { Metadata } from "next";
import { Navegacion, PieDePagina } from "@/app/_componentes-landing/Layout";

export const metadata: Metadata = {
  title: "Términos de Servicio — Sass-CRM",
  description:
    "Términos y condiciones que rigen el uso de Sass-CRM, plataforma de automatización de WhatsApp con IA.",
};

const SECCIONES = [
  {
    n: "01",
    t: "Aceptación",
    clave: "aceptacion",
    body: (
      <>
        <p>
          Al crear una cuenta o usar Sass-CRM (en adelante, <em>el servicio</em> o
          <em> la plataforma</em>) aceptás estos Términos de Servicio en su totalidad.
          Si no estás de acuerdo con alguno de los puntos, no uses el servicio.
        </p>
        <p>
          Estos términos forman un contrato legal entre vos (el <em>usuario</em> o
          <em> titular de la cuenta</em>) y el operador de Sass-CRM. Leélos con calma.
        </p>
      </>
    ),
  },
  {
    n: "02",
    t: "Descripción del servicio",
    clave: "descripcion",
    body: (
      <>
        <p>
          Sass-CRM es una plataforma multi-tenant que conecta números de WhatsApp
          de negocios y opera sobre ellos un agente de inteligencia artificial.
          El agente puede responder mensajes, agendar citas, capturar datos del
          contacto, derivar a un humano y ejecutar tareas relacionadas con la
          atención y la venta.
        </p>
        <p>
          Adicionalmente la plataforma ofrece, en planes específicos, funciones
          de captación de leads (vía Apify), voz clonada (vía ElevenLabs) y
          llamadas salientes con IA (vía Vapi).
        </p>
        <p>
          El servicio se ofrece <span className="font-mono text-emerald-300">tal cual</span>{" "}
          y según disponibilidad. Estamos en una fase de evolución activa: las
          funciones pueden cambiar, agregarse o retirarse.
        </p>
      </>
    ),
  },
  {
    n: "03",
    t: "Cuenta y elegibilidad",
    clave: "cuenta",
    body: (
      <>
        <ul>
          <li>Tenés que ser mayor de 18 años para usar el servicio.</li>
          <li>
            Los datos que cargás (nombre, email, teléfono, datos de tu negocio)
            tienen que ser veraces y estar al día.
          </li>
          <li>
            Una persona o empresa puede tener una sola cuenta. No está permitido
            crear cuentas duplicadas para evadir límites o sanciones.
          </li>
          <li>
            Sos responsable de mantener seguras tus credenciales y de toda la
            actividad que ocurra bajo tu cuenta.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: "04",
    t: "Uso aceptable",
    clave: "uso-aceptable",
    body: (
      <>
        <p>No podés usar Sass-CRM para:</p>
        <ul>
          <li>
            Enviar spam masivo, mensajes no solicitados a contactos que no
            consintieron, ni cualquier práctica que viole los Términos de
            Servicio de WhatsApp/Meta.
          </li>
          <li>
            Distribuir contenido ilegal, fraudulento, engañoso, difamatorio,
            pornográfico, violento o que incite al odio.
          </li>
          <li>
            Hostigar, acosar, suplantar identidades o realizar estafas a través
            de los canales conectados.
          </li>
          <li>
            Vender productos o servicios prohibidos por la legislación de tu
            país o por las políticas comerciales de Meta.
          </li>
          <li>
            Intentar vulnerar la seguridad del servicio, hacer ingeniería
            inversa, sobrecargar la API o saltar límites técnicos.
          </li>
        </ul>
        <p>
          Detectamos y sancionamos estos usos. La violación puede derivar en
          suspensión inmediata sin reembolso.
        </p>
      </>
    ),
  },
  {
    n: "05",
    t: "Naturaleza de la conexión a WhatsApp",
    clave: "whatsapp",
    body: (
      <>
        <p>
          La plataforma se conecta a WhatsApp a través de un cliente
          no-oficial basado en la librería <span className="font-mono text-emerald-300">Baileys</span>{" "}
          (WhatsApp Web). Esto implica que:
        </p>
        <ul>
          <li>
            La conexión depende de la infraestructura pública de WhatsApp Web,
            sobre la cual no tenemos control.
          </li>
          <li>
            Existe el riesgo de que Meta suspenda, limite o banee tu número.
            Aplicamos buenas prácticas (límites diarios, jitter, horarios) para
            reducirlo, pero no lo podemos eliminar.
          </li>
          <li>
            No garantizamos disponibilidad ininterrumpida. Pueden producirse
            desconexiones por causas ajenas (cambios del lado de Meta, cortes
            de internet, mantenimientos).
          </li>
          <li>
            El número que conectás es tuyo y seguís siendo el responsable
            frente a WhatsApp/Meta de su uso.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: "06",
    t: "IA y precisión",
    clave: "ia-precision",
    body: (
      <>
        <p>
          La IA puede equivocarse. Puede dar respuestas incorrectas, agendar
          mal, malinterpretar al cliente, ofrecer un precio equivocado o
          inventar información (alucinar).
        </p>
        <p>
          Es tu responsabilidad:
        </p>
        <ul>
          <li>Revisar las conversaciones críticas (cobros, citas, compromisos).</li>
          <li>
            Configurar correctamente el prompt, el catálogo y las reglas de
            handoff humano.
          </li>
          <li>
            Validar con tu cliente cualquier información sensible antes de
            ejecutar una transacción.
          </li>
        </ul>
        <p>
          No nos hacemos responsables de pérdidas ocasionadas por una
          respuesta automática que no fue supervisada.
        </p>
      </>
    ),
  },
  {
    n: "07",
    t: "Pagos y suscripciones",
    clave: "pagos",
    body: (
      <>
        <p>
          Los pagos se procesan a través de PayPal. La suscripción es mensual
          recurrente: PayPal te cobra automáticamente cada 30 días hasta que
          cancelés.
        </p>
        <ul>
          <li>
            Podés cancelar en cualquier momento desde tu panel o desde PayPal.
            Mantenés el acceso hasta el final del período ya pagado.
          </li>
          <li>
            No realizamos reembolsos prorrateados de meses ya cobrados.
          </li>
          <li>
            Si un cobro recurrente falla, suspendemos el servicio hasta
            regularizar el pago.
          </li>
          <li>
            Los precios pueden cambiar con un aviso previo de 30 días por
            email. Si no estás de acuerdo, podés cancelar antes del próximo
            ciclo.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: "08",
    t: "Créditos y recargas",
    clave: "creditos",
    body: (
      <>
        <p>
          Algunas funciones (llamadas con Vapi, voz clonada, captación con
          Apify, modelos premium) consumen créditos que se compran como
          recargas one-time.
        </p>
        <ul>
          <li>
            Los créditos son <strong>crédito de servicio</strong>: solo sirven
            para usar dentro de Sass-CRM.
          </li>
          <li>
            No son convertibles a dinero ni reembolsables una vez acreditados.
          </li>
          <li>
            Los créditos no expiran durante los <strong>12 meses</strong>{" "}
            posteriores a su compra. Pasado ese plazo, el saldo no consumido
            puede ser dado de baja.
          </li>
          <li>
            Si terminás tu cuenta, el saldo de créditos se pierde.
          </li>
        </ul>
      </>
    ),
  },
  {
    n: "09",
    t: "Propiedad intelectual",
    clave: "propiedad-intelectual",
    body: (
      <>
        <p>
          El contenido que cargás o generás dentro de tu cuenta (catálogo,
          conversaciones, audios, contactos, prompts) es tuyo. Solo lo usamos
          para prestarte el servicio.
        </p>
        <p>
          El software, el diseño, la marca Sass-CRM, los textos del producto y
          el código fuente son propiedad nuestra y están protegidos por la
          legislación de propiedad intelectual aplicable.
        </p>
        <p>
          No otorgamos licencia para copiar, redistribuir, sublicenciar o
          revender el software, salvo en los planes que lo habilitan
          expresamente (white-label).
        </p>
      </>
    ),
  },
  {
    n: "10",
    t: "Limitación de responsabilidad",
    clave: "responsabilidad",
    body: (
      <>
        <p>
          En la máxima medida que permita la ley, no nos hacemos responsables
          por:
        </p>
        <ul>
          <li>
            Pérdidas comerciales (ventas no concretadas, lucro cesante, daño
            de imagen) derivadas de cortes del servicio, errores de la IA,
            bans de WhatsApp/Meta, o cambios de proveedores externos.
          </li>
          <li>
            Daños indirectos, incidentales, especiales o consecuenciales.
          </li>
          <li>
            Acciones de terceros (OpenAI, ElevenLabs, Vapi, Apify, Supabase,
            PayPal, Resend) sobre los cuales no tenemos control directo.
          </li>
        </ul>
        <p>
          Nuestra responsabilidad total frente a vos, por cualquier reclamo
          relacionado con el servicio, no excederá el monto pagado por vos en
          los <strong>12 meses</strong> previos al hecho que origina el
          reclamo.
        </p>
      </>
    ),
  },
  {
    n: "11",
    t: "Suspensión y terminación",
    clave: "suspension",
    body: (
      <>
        <p>
          Podemos suspender o terminar tu cuenta, con o sin aviso, si:
        </p>
        <ul>
          <li>Violás estos términos o la política de uso aceptable.</li>
          <li>Tu uso pone en riesgo la integridad o reputación del servicio.</li>
          <li>Tenés pagos pendientes después de un período razonable.</li>
          <li>Una autoridad competente lo ordena.</li>
        </ul>
        <p>
          Vos podés terminar tu cuenta en cualquier momento desde el panel o
          contactándonos. Tras la terminación, eliminamos tus datos según la
          política descrita en la <a href="/privacidad" className="text-emerald-400 underline-offset-4 hover:underline">Política de Privacidad</a>.
        </p>
      </>
    ),
  },
  {
    n: "12",
    t: "Modificaciones",
    clave: "modificaciones",
    body: (
      <>
        <p>
          Podemos modificar estos términos. Cuando los cambios sean
          sustanciales, te avisaremos por email o desde el panel con al menos{" "}
          <strong>30 días</strong> de anticipación.
        </p>
        <p>
          Si seguís usando el servicio luego de la fecha de entrada en vigor,
          se entiende que aceptás los términos modificados. Si no estás de
          acuerdo, podés cancelar tu suscripción antes de esa fecha.
        </p>
      </>
    ),
  },
  {
    n: "13",
    t: "Ley aplicable y jurisdicción",
    clave: "jurisdiccion",
    body: (
      <>
        <p>
          Estos términos se rigen por la legislación del país de operación de
          Sass-CRM. Cualquier controversia se someterá a los tribunales
          competentes de esa jurisdicción.
        </p>
        <p className="font-mono text-[12px] text-white/50">
          // jurisdicción: <span className="text-emerald-300">Ciudad/País — completar con datos del operador</span>
        </p>
      </>
    ),
  },
  {
    n: "14",
    t: "Contacto",
    clave: "contacto",
    body: (
      <>
        <p>
          Para consultas sobre estos términos, escribinos a{" "}
          <a
            href="mailto:legal@sass-crm.com"
            className="font-mono text-emerald-300 underline-offset-4 hover:underline"
          >
            legal@sass-crm.com
          </a>
          .
        </p>
      </>
    ),
  },
];

export default function PaginaTerminos() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navegacion />

      {/* Page header */}
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
        <p className="mb-3 inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Última actualización: 2026-05-04
        </p>
        <h1 className="font-bold tracking-tight text-4xl text-zinc-100 md:text-5xl">
          Términos de Servicio
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
          Las reglas que rigen el uso de Sass-CRM. Las escribimos en español
          claro porque queremos que las leas, no que las saltes.
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
