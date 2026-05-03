"use client";

import { useState } from "react";

interface WebhookSaliente {
  id: string;
  cuenta_id: string;
  nombre: string;
  url: string;
  eventos: string[];
  secret: string | null;
  esta_activo: boolean;
  ultimo_disparo_en: string | null;
  ultimo_resultado: string | null;
  total_disparos: number;
  total_fallos: number;
  creado_en: string;
}

const CATEGORIAS_EVENTOS: Array<{
  id: string;
  titulo: string;
  icono: string;
  color: "emerald" | "blue" | "amber";
  eventos: Array<{ id: string; label: string; descripcion: string }>;
}> = [
  {
    id: "mensajes",
    titulo: "Mensajes",
    icono: "💬",
    color: "emerald",
    eventos: [
      { id: "mensaje_recibido", label: "mensaje.recibido", descripcion: "Llega un mensaje del cliente" },
      { id: "mensaje_enviado", label: "mensaje.enviado", descripcion: "El bot o el operador envía un mensaje" },
    ],
  },
  {
    id: "contactos",
    titulo: "Contactos & Leads",
    icono: "👥",
    color: "blue",
    eventos: [
      { id: "contacto_nuevo", label: "contacto.creado", descripcion: "Llega un cliente que no estaba en la base" },
      { id: "contacto_actualizado", label: "contacto.actualizado", descripcion: "Se capturan datos nuevos del cliente" },
      { id: "handoff_humano", label: "handoff.humano", descripcion: "La conversación pasa a humano" },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda",
    icono: "📅",
    color: "amber",
    eventos: [
      { id: "cita_agendada", label: "cita.agendada", descripcion: "Se crea una cita nueva" },
      { id: "cita_modificada", label: "cita.modificada", descripcion: "Se cambia la fecha de una cita existente" },
      { id: "cita_cancelada", label: "cita.cancelada", descripcion: "Se cancela una cita" },
      { id: "llamada_terminada", label: "llamada.terminada", descripcion: "Termina una llamada Vapi" },
    ],
  },
];

const COLORES_CATEGORIA: Record<string, string> = {
  emerald: "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-500/30",
  blue: "bg-blue-50 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-500/30",
  amber: "bg-amber-50 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-500/30",
};

const COLOR_LABEL: Record<string, string> = {
  emerald: "text-emerald-700 dark:text-emerald-300",
  blue: "text-blue-700 dark:text-blue-300",
  amber: "text-amber-700 dark:text-amber-300",
};

export function ModalWebhook({
  idCuenta,
  inicial,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  inicial: WebhookSaliente | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [url, setUrl] = useState(inicial?.url ?? "");
  const [secret, setSecret] = useState(inicial?.secret ?? "");
  const [eventosEleg, setEventosEleg] = useState<string[]>(
    inicial?.eventos ?? [],
  );
  const [activo, setActivo] = useState(inicial?.esta_activo ?? true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarEvento(id: string) {
    setEventosEleg((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !url.trim() || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const cuerpo = {
        nombre: nombre.trim(),
        url: url.trim(),
        secret: secret.trim() || null,
        eventos: eventosEleg,
        esta_activo: activo,
      };
      const apiUrl = inicial
        ? `/api/cuentas/${idCuenta}/webhooks/${inicial.id}`
        : `/api/cuentas/${idCuenta}/webhooks`;
      const metodo = inicial ? "PATCH" : "POST";
      const res = await fetch(apiUrl, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      onGuardado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            {inicial ? "Editar Webhook" : "Nuevo Webhook"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-4 px-6 py-5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Zapier, Mi CRM, HubSpot"
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              URL del Webhook *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/..."
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              URL donde enviaremos los eventos (POST)
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Secret (opcional)
            </label>
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="tu-secret-key"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Lo enviamos en el header <code className="font-mono">x-webhook-secret</code> para que verifiques que el request vino de nosotros
            </p>
          </div>

          {/* Eventos agrupados por categoría */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Eventos a recibir *
            </label>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Marcá los eventos para los que querés que disparemos el POST. Si
              no seleccionás ninguno, el webhook recibe TODOS.
            </p>

            <div className="mt-3 space-y-3">
              {CATEGORIAS_EVENTOS.map((cat) => (
                <div
                  key={cat.id}
                  className={`rounded-2xl ring-1 p-3 ${COLORES_CATEGORIA[cat.color]}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-base">{cat.icono}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${COLOR_LABEL[cat.color]}`}
                    >
                      {cat.titulo}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                    {cat.eventos.map((ev) => {
                      const seleccionado = eventosEleg.includes(ev.id);
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => alternarEvento(ev.id)}
                          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-all ${
                            seleccionado
                              ? "border-emerald-500 bg-white shadow-sm dark:bg-zinc-900"
                              : "border-zinc-200 bg-white/50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              seleccionado
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-zinc-300 dark:border-zinc-700"
                            }`}
                          >
                            {seleccionado && (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="h-3 w-3"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-xs font-semibold">
                              {ev.label}
                            </p>
                            <p className="text-[10px] text-zinc-500">
                              {ev.descripcion}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle activo */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div>
              <p className="text-sm font-semibold">Webhook activo</p>
              <p className="text-[10px] text-zinc-500">
                Desactivalo para pausar sin eliminar
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivo((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                activo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  activo ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCerrar}
              disabled={enviando}
              className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !nombre.trim() || !url.trim()}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Guardando…" : "Guardar Webhook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
