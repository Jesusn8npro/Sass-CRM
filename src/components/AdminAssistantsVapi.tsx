"use client";

import { useEffect, useState } from "react";
import type { AssistantVapi } from "@/lib/baseDatos";
import { PruebaAssistantVapi } from "./PruebaAssistantVapi";

interface Props {
  idCuenta: string;
  /** Public key de Vapi inicial de la cuenta — el componente igual
   *  consulta /vapi/estado para resolver el fallback al .env. */
  vapiPublicKey: string | null;
}

interface EstadoVapi {
  publicKey: string | null;
  phoneNumberId: string | null;
  configurado: boolean;
}

/**
 * Sección "Assistants Vapi" en /configuracion.
 * Lista todos los assistants de la cuenta + form crear + edición inline +
 * botón sincronizar (push a Vapi) + botón probar (Web SDK).
 *
 * Una cuenta puede tener N assistants (vendedor / soporte / cobranza).
 * Uno marcado como default — es el que el bot usa cuando la IA decide llamar.
 */
export function AdminAssistantsVapi({ idCuenta, vapiPublicKey }: Props) {
  const [assistants, setAssistants] = useState<AssistantVapi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publicKeyEfectiva, setPublicKeyEfectiva] = useState<string | null>(
    vapiPublicKey,
  );

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/assistants`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { assistants: AssistantVapi[] };
        setAssistants(data.assistants);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // Consultar la public key efectiva (cuenta o fallback al env)
    fetch(`/api/cuentas/${idCuenta}/vapi/estado`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EstadoVapi | null) => {
        if (d?.publicKey) setPublicKeyEfectiva(d.publicKey);
      })
      .catch(() => {});
  }, [idCuenta]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreNuevo.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/assistants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreNuevo.trim(),
          es_default: assistants.length === 0, // primer assistant es default
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error creando assistant");
        return;
      }
      setNombreNuevo("");
      await cargar();
    } finally {
      setCreando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Assistants Vapi</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Múltiples agentes de voz por cuenta (vendedor, soporte, cobranza).
          El marcado como{" "}
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            default
          </span>{" "}
          es el que usa el bot cuando la IA decide llamar.
        </p>
      </div>

      <form onSubmit={crear} className="mb-4 flex gap-2">
        <input
          type="text"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Ej: Vendedor cierre, Soporte técnico, Cobranza..."
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={!nombreNuevo.trim() || creando}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {creando ? "Creando…" : "Crear"}
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-xs text-zinc-500">Cargando…</p>
      ) : assistants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/50">
          No hay assistants creados. Creá el primero arriba.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {assistants.map((a) => (
            <FilaAssistant
              key={a.id}
              assistant={a}
              idCuenta={idCuenta}
              vapiPublicKey={publicKeyEfectiva}
              onCambio={cargar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilaAssistant({
  assistant,
  idCuenta,
  vapiPublicKey,
  onCambio,
}: {
  assistant: AssistantVapi;
  idCuenta: string;
  vapiPublicKey: string | null;
  onCambio: () => void | Promise<void>;
}) {
  const [expandido, setExpandido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [nombre, setNombre] = useState(assistant.nombre);
  const [primerMensaje, setPrimerMensaje] = useState(assistant.primer_mensaje);
  const [promptExtra, setPromptExtra] = useState(assistant.prompt_extra);
  const [maxSeg, setMaxSeg] = useState(assistant.max_segundos);
  const [grabar, setGrabar] = useState(assistant.grabar);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/assistants/${assistant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre,
            primer_mensaje: primerMensaje,
            prompt_extra: promptExtra,
            max_segundos: maxSeg,
            grabar,
          }),
        },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error guardando");
        return;
      }
      setOk("Guardado.");
      await onCambio();
    } finally {
      setGuardando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/assistants/${assistant.id}/sincronizar`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string; creado?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Error sincronizando");
        return;
      }
      setOk(data.creado ? "Creado en Vapi." : "Actualizado en Vapi.");
      await onCambio();
    } finally {
      setSincronizando(false);
    }
  }

  async function marcarDefault() {
    setError(null);
    const res = await fetch(
      `/api/cuentas/${idCuenta}/assistants/${assistant.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ es_default: true }),
      },
    );
    if (res.ok) {
      setOk("Ahora es el default.");
      await onCambio();
    } else {
      setError("No se pudo marcar como default");
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar el assistant "${assistant.nombre}"?`)) return;
    setBorrando(true);
    try {
      await fetch(
        `/api/cuentas/${idCuenta}/assistants/${assistant.id}`,
        { method: "DELETE" },
      );
      await onCambio();
    } finally {
      setBorrando(false);
    }
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{assistant.nombre}</h4>
            {assistant.es_default && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Default
              </span>
            )}
            {!assistant.vapi_assistant_id && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Sin sincronizar
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">
            {assistant.vapi_assistant_id ?? "(no creado en Vapi todavía)"}
          </p>
          {assistant.sincronizado_en && (
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Sincronizado:{" "}
              {new Date(assistant.sincronizado_en).toLocaleString("es-AR")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpandido((e) => !e)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {expandido ? "Cerrar" : "Editar"}
        </button>
      </div>

      {expandido && (
        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Nombre interno
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Primer mensaje (lo que dice al contestar)
            </label>
            <input
              type="text"
              value={primerMensaje}
              onChange={(e) => setPrimerMensaje(e.target.value)}
              placeholder="Hola, te llamo de... ¿tenés un momento?"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Instrucciones extra (rol específico de este assistant)
            </label>
            <textarea
              value={promptExtra}
              onChange={(e) => setPromptExtra(e.target.value)}
              rows={4}
              placeholder="Ej: Sos el agente de cobranza. Tono firme pero respetuoso. Tu objetivo es..."
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Duración máxima (seg)
              </label>
              <input
                type="number"
                min={30}
                max={3600}
                value={maxSeg}
                onChange={(e) => setMaxSeg(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={grabar}
                  onChange={(e) => setGrabar(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Grabar llamadas
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={sincronizar}
              disabled={sincronizando}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {sincronizando
                ? "Sincronizando…"
                : assistant.vapi_assistant_id
                ? "↻ Re-sync con Vapi"
                : "↑ Crear en Vapi"}
            </button>
            {!assistant.es_default && (
              <button
                type="button"
                onClick={marcarDefault}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Marcar como default
              </button>
            )}
            <button
              type="button"
              onClick={borrar}
              disabled={borrando}
              className="ml-auto rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              {borrando ? "Borrando…" : "Borrar"}
            </button>
          </div>

          {/* Probar con micrófono (Web SDK) */}
          {assistant.vapi_assistant_id && vapiPublicKey && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <PruebaAssistantVapi
                vapiPublicKey={vapiPublicKey}
                vapiAssistantId={assistant.vapi_assistant_id}
                nombreAssistant={assistant.nombre}
              />
            </div>
          )}
          {!vapiPublicKey && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Para probar con micrófono, pegá la <strong>Vapi Public Key</strong>{" "}
              arriba en la sección de Vapi.
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}
          {ok && (
            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {ok}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
