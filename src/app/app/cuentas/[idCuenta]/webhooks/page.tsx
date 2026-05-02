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

const ETIQUETA_EVENTO: Record<string, string> = {
  mensaje_recibido: "Mensaje recibido",
  mensaje_enviado: "Mensaje enviado",
  contacto_nuevo: "Contacto nuevo",
  cita_agendada: "Cita agendada",
  llamada_terminada: "Llamada terminada",
  handoff_humano: "Handoff a humano",
};

export default function PaginaWebhooks() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [webhooks, setWebhooks] = useState<WebhookSaliente[]>([]);
  const [disponibles, setDisponibles] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  // Form crear
  const [creandoOpen, setCreandoOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [eventosEleg, setEventosEleg] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/webhooks`, {
        cache: "no-store",
      });
      if (res.ok) {
        const d = (await res.json()) as RespuestaLista;
        setWebhooks(d.webhooks);
        setDisponibles(d.eventos_disponibles);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !url.trim() || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          url: url.trim(),
          eventos: eventosEleg,
          secret: secret.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error creando");
        return;
      }
      setNombre("");
      setUrl("");
      setSecret("");
      setEventosEleg([]);
      setCreandoOpen(false);
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  async function probar(id: string) {
    const res = await fetch(
      `/api/cuentas/${idCuenta}/webhooks/${id}/probar`,
      { method: "POST" },
    );
    const d = (await res.json()) as { resultado?: string; error?: string };
    alert(d.resultado ?? d.error ?? "Sin respuesta");
    await cargar();
  }

  async function toggle(w: WebhookSaliente) {
    await fetch(`/api/cuentas/${idCuenta}/webhooks/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esta_activo: !w.esta_activo }),
    });
    await cargar();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este webhook?")) return;
    await fetch(`/api/cuentas/${idCuenta}/webhooks/${id}`, {
      method: "DELETE",
    });
    await cargar();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Integraciones
          </p>
          <h1 className="text-lg font-bold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Conectá el bot a n8n, Make, Zapier o cualquier endpoint propio.
            Recibís un POST con JSON cada vez que pasa un evento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreandoOpen((o) => !o)}
          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-400"
        >
          {creandoOpen ? "Cancelar" : "+ Nuevo webhook"}
        </button>
      </header>

      {creandoOpen && (
        <form
          onSubmit={crear}
          className="mb-6 space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5"
        >
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre (ej: n8n producción, Slack ventas)"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://n8n.tu-dominio.com/webhook/..."
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Secret opcional (se manda en header x-webhook-secret)"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div>
            <p className="mb-1 text-xs font-medium text-zinc-500">
              Eventos a recibir (vacío = todos)
            </p>
            <div className="flex flex-wrap gap-2">
              {disponibles.map((ev) => (
                <label
                  key={ev}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs hover:border-emerald-500/40 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <input
                    type="checkbox"
                    checked={eventosEleg.includes(ev)}
                    onChange={(e) => {
                      if (e.target.checked) setEventosEleg([...eventosEleg, ev]);
                      else setEventosEleg(eventosEleg.filter((x) => x !== ev));
                    }}
                    className="h-3 w-3"
                  />
                  {ETIQUETA_EVENTO[ev] ?? ev}
                </label>
              ))}
            </div>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {enviando ? "Creando…" : "Crear webhook"}
          </button>
        </form>
      )}

      {cargando ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : webhooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 text-4xl">🔗</div>
          <p className="font-semibold">No hay webhooks configurados</p>
          <p className="mt-1 text-xs text-zinc-500">
            Creá uno arriba para empezar a recibir eventos en tiempo real.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {webhooks.map((w) => (
            <li
              key={w.id}
              className={`rounded-2xl border p-5 ${
                w.esta_activo
                  ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  : "border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/40"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{w.nombre}</h3>
                    {!w.esta_activo && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                        Pausado
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                    {w.url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => probar(w.id)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium hover:border-emerald-500/40 dark:border-zinc-700"
                  >
                    Probar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(w)}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium hover:border-zinc-300 dark:border-zinc-700"
                  >
                    {w.esta_activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(w.id)}
                    className="rounded-full border border-red-300 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
                  >
                    Borrar
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {w.eventos.length === 0 ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    Todos los eventos
                  </span>
                ) : (
                  w.eventos.map((ev) => (
                    <span
                      key={ev}
                      className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] dark:bg-zinc-800"
                    >
                      {ETIQUETA_EVENTO[ev] ?? ev}
                    </span>
                  ))
                )}
              </div>
              {(w.ultimo_disparo_en || w.total_disparos > 0) && (
                <div className="mt-3 flex items-center gap-4 border-t border-zinc-100 pt-3 text-[10px] text-zinc-500 dark:border-zinc-800">
                  <span>
                    {w.total_disparos} disparo{w.total_disparos === 1 ? "" : "s"}
                  </span>
                  {w.total_fallos > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {w.total_fallos} fallo{w.total_fallos === 1 ? "" : "s"}
                    </span>
                  )}
                  {w.ultimo_disparo_en && (
                    <span>
                      Último: {new Date(w.ultimo_disparo_en).toLocaleString("es-AR")}{" "}
                      — {w.ultimo_resultado}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
