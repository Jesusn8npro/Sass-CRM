"use client";

import { useEffect, useState } from "react";
import type {
  AssistantVapi,
  ConversacionConPreview,
  LlamadaProgramadaConContexto,
} from "@/lib/baseDatos";

interface Props {
  idCuenta: string;
}

/**
 * Sección "Llamadas Programadas" para insertar arriba de la lista
 * de llamadas históricas. Permite ver, crear y cancelar llamadas
 * Vapi a futuro.
 *
 * El scheduler en cicloVida.ts las dispara automáticamente cuando
 * pasa la hora.
 */
export function LlamadasProgramadas({ idCuenta }: Props) {
  const [llamadas, setLlamadas] = useState<LlamadaProgramadaConContexto[]>([]);
  const [conversaciones, setConversaciones] = useState<
    ConversacionConPreview[]
  >([]);
  const [assistants, setAssistants] = useState<AssistantVapi[]>([]);
  const [creandoOpen, setCreandoOpen] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Form state
  const [convId, setConvId] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [fecha, setFecha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}/llamadas-programadas`, {
          cache: "no-store",
        }),
        fetch(`/api/cuentas/${idCuenta}/conversaciones`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/assistants`, { cache: "no-store" }),
      ]);
      if (r1.ok) {
        const d = (await r1.json()) as {
          llamadas: LlamadaProgramadaConContexto[];
        };
        setLlamadas(d.llamadas);
      }
      if (r2.ok) {
        const d = (await r2.json()) as {
          conversaciones: ConversacionConPreview[];
        };
        setConversaciones(d.conversaciones);
      }
      if (r3.ok) {
        const d = (await r3.json()) as { assistants: AssistantVapi[] };
        setAssistants(d.assistants);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [idCuenta]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!convId || !fecha) {
      setError("Conversación y fecha son obligatorios");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      // datetime-local devuelve YYYY-MM-DDTHH:mm sin zona — lo convertimos
      // a ISO asumiendo zona local del navegador.
      const fechaISO = new Date(fecha).toISOString();
      const res = await fetch(
        `/api/cuentas/${idCuenta}/llamadas-programadas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversacion_id: convId,
            assistant_id: assistantId || null,
            motivo: motivo.trim() || null,
            programada_para: fechaISO,
          }),
        },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error programando");
        return;
      }
      setConvId("");
      setAssistantId("");
      setFecha("");
      setMotivo("");
      setCreandoOpen(false);
      await cargar();
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id: string) {
    if (!confirm("¿Cancelar esta llamada programada?")) return;
    const res = await fetch(
      `/api/cuentas/${idCuenta}/llamadas-programadas/${id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razon: "cancelada por el operador" }),
      },
    );
    if (res.ok) await cargar();
  }

  const pendientes = llamadas.filter((l) => l.estado === "pendiente");
  const otras = llamadas.filter((l) => l.estado !== "pendiente").slice(0, 10);

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Llamadas programadas</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {pendientes.length === 0
              ? "Sin llamadas programadas pendientes."
              : `${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"} — el bot las dispara automático cuando llega la hora.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreandoOpen((o) => !o)}
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          {creandoOpen ? "Cancelar" : "+ Programar llamada"}
        </button>
      </div>

      {creandoOpen && (
        <form
          onSubmit={crear}
          className="mb-4 grid gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Conversación
            </label>
            <select
              value={convId}
              onChange={(e) => setConvId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— Elegí una conversación —</option>
              {conversaciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre ?? `+${c.telefono}`} (+{c.telefono})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Fecha y hora
            </label>
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Assistant a usar
            </label>
            <select
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— Default de la cuenta —</option>
              {assistants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} {a.es_default ? "(default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Motivo / contexto (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ej: cierre venta plan premium acordado el viernes"
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          {error && (
            <p className="md:col-span-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {enviando ? "Programando…" : "Programar llamada"}
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="text-xs text-zinc-500">Cargando…</p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <div className="space-y-2">
              {pendientes.map((l) => (
                <FilaProgramada
                  key={l.id}
                  llamada={l}
                  onCancelar={() => cancelar(l.id)}
                />
              ))}
            </div>
          )}
          {otras.length > 0 && (
            <details className="mt-4 group">
              <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                Mostrar últimas {otras.length} ya procesadas
              </summary>
              <div className="mt-2 space-y-2">
                {otras.map((l) => (
                  <FilaProgramada key={l.id} llamada={l} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function FilaProgramada({
  llamada,
  onCancelar,
}: {
  llamada: LlamadaProgramadaConContexto;
  onCancelar?: () => void;
}) {
  const colorEstado: Record<string, string> = {
    pendiente:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    ejecutada:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    cancelada: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    fallida: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };
  const fecha = new Date(llamada.programada_para);
  const fechaStr = fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const nombreCliente = llamada.nombre_contacto ?? `+${llamada.telefono_conv ?? ""}`;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colorEstado[llamada.estado] ?? colorEstado.pendiente}`}
          >
            {llamada.estado}
          </span>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {fechaStr}
          </span>
          {llamada.origen === "ia" && (
            <span className="text-[10px] text-zinc-500">🤖 por IA</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-semibold">
          {nombreCliente}
        </p>
        {llamada.motivo && (
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {llamada.motivo}
          </p>
        )}
        {llamada.assistant_nombre && (
          <p className="mt-0.5 text-[10px] text-zinc-500">
            Assistant: {llamada.assistant_nombre}
          </p>
        )}
        {llamada.razon_cancelacion && (
          <p className="mt-1 text-[10px] italic text-red-600 dark:text-red-400">
            {llamada.razon_cancelacion}
          </p>
        )}
      </div>
      {onCancelar && llamada.estado === "pendiente" && (
        <button
          type="button"
          onClick={onCancelar}
          className="shrink-0 rounded-full border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700 hover:border-red-400 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-red-900/20"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
