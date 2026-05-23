import type { Metadata } from "next";
import { Navegacion, PieDePagina } from "@/app/_componentes-landing/Layout";

export const metadata: Metadata = {
  title: "Documentación — INYECTAIA",
  description: "Guía de integración: webhooks salientes, API REST y autenticación.",
};

const EVENTOS = [
  { nombre: "mensaje_recibido", desc: "Un contacto envía un mensaje al número conectado." },
  { nombre: "mensaje_enviado", desc: "El agente o un operador humano envía un mensaje." },
  { nombre: "contacto_nuevo", desc: "Se registra un contacto nuevo en el CRM." },
  { nombre: "contacto_actualizado", desc: "Se editan los datos capturados de un lead." },
  { nombre: "cita_agendada", desc: "El agente agenda una cita en el calendario." },
  { nombre: "cita_modificada", desc: "Se cambia la hora o los datos de una cita existente." },
  { nombre: "cita_cancelada", desc: "Una cita es cancelada por el agente o el operador." },
  { nombre: "llamada_terminada", desc: "Finaliza una llamada saliente gestionada por Vapi." },
  { nombre: "handoff_humano", desc: "El agente detecta que la conversación requiere atención humana." },
];

const SECCIONES = [
  { n: "01", t: "Webhooks Salientes", clave: "webhooks" },
  { n: "02", t: "Eventos disponibles", clave: "eventos" },
  { n: "03", t: "API Keys", clave: "api-keys" },
  { n: "04", t: "Configuración en el panel", clave: "configuracion" },
];

export default function PaginaDocs() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navegacion />

      <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 md:pt-24 md:pb-14">
        <p className="mb-3 inline-block rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Referencia técnica · v1
        </p>
        <h1 className="font-bold tracking-tight text-4xl text-zinc-100 md:text-5xl">
          Documentación
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-400">
          Guía de integración: webhooks salientes, eventos disponibles, autenticación con API keys y
          configuración desde el panel.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24 lg:flex lg:gap-16">
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

        <main className="min-w-0 flex-1">
          {/* 01 — Webhooks Salientes */}
          <section id="webhooks" className="scroll-mt-24 border-b border-white/[0.04] py-8">
            <h2 className="mb-3 text-lg font-bold text-zinc-100">Webhooks Salientes</h2>
            <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
              <p>
                Cuando ocurre un evento en tu cuenta, INYECTAIA hace un <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-emerald-300">POST</code> a la URL que configuraste. El payload llega en JSON con la siguiente estructura:
              </p>
              <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-zinc-900 p-4 font-mono text-sm text-emerald-300">{`{
  "evento": "mensaje_recibido",
  "cuenta_id": "uuid",
  "timestamp": "2025-01-01T00:00:00Z",
  "datos": { ... }
}`}</pre>
              <p>
                Para verificar que la llamada proviene de INYECTAIA, compará el header{" "}
                <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-emerald-300">x-webhook-secret</code>{" "}
                contra el valor que configuraste en el panel. Si no coincide, rechazá la petición con <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-emerald-300">401</code>.
              </p>
              <p>
                Si tu endpoint devuelve un status diferente de <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-emerald-300">2xx</code>, el sistema reintenta 3 veces con delays de 0 ms, 500 ms y 1 000 ms.
              </p>
            </div>
          </section>

          {/* 02 — Eventos disponibles */}
          <section id="eventos" className="scroll-mt-24 border-b border-white/[0.04] py-8">
            <h2 className="mb-3 text-lg font-bold text-zinc-100">Eventos disponibles</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="py-2 pr-6 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Evento
                    </th>
                    <th className="py-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Cuándo se dispara
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTOS.map((ev) => (
                    <tr key={ev.nombre} className="border-b border-white/[0.04] last:border-b-0">
                      <td className="py-2.5 pr-6 align-top">
                        <code className="whitespace-nowrap font-mono text-xs text-emerald-300">
                          {ev.nombre}
                        </code>
                      </td>
                      <td className="py-2.5 align-top text-zinc-400">{ev.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 03 — API Keys */}
          <section id="api-keys" className="scroll-mt-24 border-b border-white/[0.04] py-8">
            <h2 className="mb-3 text-lg font-bold text-zinc-100">API Keys</h2>
            <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
              <p>
                Cada cuenta puede generar API keys desde{" "}
                <strong className="text-zinc-100">Configuración → Integraciones → API Keys</strong>.
                Podés crear múltiples keys con distintos nombres para identificar cada integración.
              </p>
              <p>
                Incluí la key en el header <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-emerald-300">Authorization</code> de cada request:
              </p>
              <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-zinc-900 p-4 font-mono text-sm text-emerald-300">{`Authorization: Bearer {tu_api_key}`}</pre>
              <p>
                Las keys no tienen fecha de expiración por defecto. Podés revocarlas desde el panel en cualquier momento.
              </p>
            </div>
          </section>

          {/* 04 — Configuración en el panel */}
          <section id="configuracion" className="scroll-mt-24 py-8">
            <h2 className="mb-3 text-lg font-bold text-zinc-100">Configuración en el panel</h2>
            <div className="space-y-4 text-sm leading-relaxed text-zinc-400">
              <p>Para agregar un webhook desde el panel:</p>
              <ol className="ml-5 list-decimal space-y-2">
                <li>
                  Andá a <strong className="text-zinc-100">Configuración → Integraciones → Webhooks</strong>.
                </li>
                <li>Hacé click en <strong className="text-zinc-100">Nuevo webhook</strong>.</li>
                <li>Ingresá la URL de tu endpoint y elegí los eventos que querés recibir.</li>
                <li>
                  Copiá el <strong className="text-zinc-100">webhook secret</strong> generado y usalo en tu servidor para verificar las llamadas.
                </li>
                <li>Guardá y hacé un test desde el panel para confirmar que llegue correctamente.</li>
              </ol>
              <p>
                ¿Todavía no tenés cuenta?{" "}
                <a
                  href="/signup"
                  className="font-medium text-emerald-300 underline-offset-4 hover:underline"
                >
                  Empezar gratis →
                </a>
              </p>
            </div>
          </section>

          <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            fin del documento · <span className="text-emerald-400">v1.0</span>
          </div>
        </main>
      </div>

      <PieDePagina />
    </div>
  );
}
