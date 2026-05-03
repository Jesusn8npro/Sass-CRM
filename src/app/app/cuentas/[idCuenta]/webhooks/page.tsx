"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

interface RespuestaLista {
  webhooks: WebhookSaliente[];
  eventos_disponibles: string[];
}

// Eventos agrupados por categoría — refleja lo que dispara el bot.
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
      {
        id: "mensaje_recibido",
        label: "mensaje.recibido",
        descripcion: "Llega un mensaje del cliente",
      },
      {
        id: "mensaje_enviado",
        label: "mensaje.enviado",
        descripcion: "El bot o el operador envía un mensaje",
      },
    ],
  },
  {
    id: "contactos",
    titulo: "Contactos & Leads",
    icono: "👥",
    color: "blue",
    eventos: [
      {
        id: "contacto_nuevo",
        label: "contacto.creado",
        descripcion: "Llega un cliente que no estaba en la base",
      },
      {
        id: "contacto_actualizado",
        label: "contacto.actualizado",
        descripcion: "Se capturan datos nuevos del cliente",
      },
      {
        id: "handoff_humano",
        label: "handoff.humano",
        descripcion: "La conversación pasa a humano",
      },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda",
    icono: "📅",
    color: "amber",
    eventos: [
      {
        id: "cita_agendada",
        label: "cita.agendada",
        descripcion: "Se crea una cita nueva",
      },
      {
        id: "cita_modificada",
        label: "cita.modificada",
        descripcion: "Se cambia la fecha de una cita existente",
      },
      {
        id: "cita_cancelada",
        label: "cita.cancelada",
        descripcion: "Se cancela una cita",
      },
      {
        id: "llamada_terminada",
        label: "llamada.terminada",
        descripcion: "Termina una llamada Vapi",
      },
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

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function PaginaWebhooks() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [webhooks, setWebhooks] = useState<WebhookSaliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<WebhookSaliente | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/webhooks`, {
        cache: "no-store",
      });
      if (res.ok) {
        const d = (await res.json()) as RespuestaLista;
        setWebhooks(d.webhooks);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  async function alternarActivo(w: WebhookSaliente) {
    await fetch(`/api/cuentas/${idCuenta}/webhooks/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esta_activo: !w.esta_activo }),
    });
    void cargar();
  }

  async function probarWebhook(id: string) {
    const res = await fetch(
      `/api/cuentas/${idCuenta}/webhooks/${id}/probar`,
      { method: "POST" },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      resultado?: string;
    };
    alert(
      data.ok
        ? `✓ Prueba exitosa: ${data.resultado ?? "OK"}`
        : `✗ Error: ${data.resultado ?? "Falló el envío"}`,
    );
    void cargar();
  }

  async function copiarUrl(url: string) {
    await navigator.clipboard.writeText(url);
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este webhook? Dejará de recibir eventos.")) return;
    await fetch(`/api/cuentas/${idCuenta}/webhooks/${id}`, {
      method: "DELETE",
    });
    void cargar();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-white via-violet-50/30 to-white px-6 pt-6 pb-4 dark:border-zinc-800 dark:from-zinc-950 dark:via-violet-950/10 dark:to-zinc-950">
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-lg text-white shadow-md">
                🔗
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                  Integraciones · Webhooks
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  Webhooks &amp; Integraciones
                </h1>
                <p className="text-xs text-zinc-500">
                  Conecta tu CRM con sistemas externos recibiendo eventos en
                  tiempo real.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setModalAbierto(true);
              }}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              + Nuevo Webhook
            </button>
          </div>

          {/* Banner explicativo */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                ℹ
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  ¿Cómo funcionan los webhooks?
                </p>
                <p className="mt-0.5 text-xs text-blue-800 dark:text-blue-200">
                  Cuando ocurre un evento (nuevo mensaje, cita agendada, etc.),
                  enviamos un POST a tu URL con los datos del evento. Podés
                  conectarlo con <strong>Zapier</strong>, <strong>Make</strong>,{" "}
                  <strong>n8n</strong>, o tu propio sistema.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 px-6 py-5 dark:bg-zinc-950">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : webhooks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-3xl">🔗</p>
            <p className="mt-2 font-semibold">Aún no tenés webhooks</p>
            <p className="mt-1 text-xs text-zinc-500">
              Tocá &quot;+ Nuevo Webhook&quot; para conectar tu CRM con n8n,
              Zapier, Make o tu sistema.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Eventos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{w.nombre}</p>
                      <p className="text-[10px] text-zinc-500">
                        Creado{" "}
                        {new Date(w.creado_en).toLocaleDateString("es-AR")}
                      </p>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p
                        className="truncate font-mono text-[11px] text-zinc-600 dark:text-zinc-400"
                        title={w.url}
                      >
                        {w.url}
                      </p>
                      {w.ultimo_disparo_en && (
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          Último disparo: {tiempoRelativo(w.ultimo_disparo_en)}
                          {w.total_fallos > 0 && (
                            <span className="ml-1 text-red-600">
                              · {w.total_fallos} fallos
                            </span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.eventos.length === 0 ? (
                          <span className="text-zinc-400">—</span>
                        ) : (
                          w.eventos.slice(0, 3).map((e) => (
                            <span
                              key={e}
                              className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[10px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                            >
                              {e.replace(/_/g, ".")}
                            </span>
                          ))
                        )}
                        {w.eventos.length > 3 && (
                          <span className="text-[10px] text-zinc-500">
                            +{w.eventos.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => alternarActivo(w)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          w.esta_activo
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${w.esta_activo ? "bg-emerald-500" : "bg-zinc-400"}`}
                        />
                        {w.esta_activo ? "Activo" : "Pausado"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => probarWebhook(w.id)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-700 dark:hover:bg-zinc-800"
                          title="Probar disparo"
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          onClick={() => copiarUrl(w.url)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-violet-700 dark:hover:bg-zinc-800"
                          title="Copiar URL"
                        >
                          ⎘
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(w);
                            setModalAbierto(true);
                          }}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-violet-700 dark:hover:bg-zinc-800"
                          title="Editar"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => borrar(w.id)}
                          className="rounded-md p-1.5 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40"
                          title="Borrar"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalWebhook
          idCuenta={idCuenta}
          inicial={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal: Crear / Editar webhook
// ============================================================

function ModalWebhook({
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
