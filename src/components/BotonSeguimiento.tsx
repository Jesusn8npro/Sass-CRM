"use client";

import { useState } from "react";

/**
 * Botón "Seguimiento" en el header del chat. Manual y por conversación:
 * genera un borrador con IA basado en ESA charla, lo muestra para que el
 * dueño lo apruebe/edite, y solo entonces lo envía. Nada masivo ni automático.
 */
export function BotonSeguimiento({
  idCuenta,
  idConversacion,
}: {
  idCuenta: string;
  idConversacion: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const url = `/api/cuentas/${idCuenta}/conversaciones/${idConversacion}/seguimiento`;

  async function abrir() {
    setAbierto(true);
    setError(null);
    setEnviado(false);
    setTexto("");
    setCargando(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "borrador" }),
      });
      const d = (await r.json()) as { borrador?: string; error?: string };
      if (r.ok && d.borrador) setTexto(d.borrador);
      else setError(d.error ?? "No se pudo generar el borrador.");
    } catch {
      setError("Error de red generando el borrador.");
    } finally {
      setCargando(false);
    }
  }

  async function enviar() {
    const mensaje = texto.trim();
    if (!mensaje) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "enviar", mensaje }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        setEnviado(true);
        setTimeout(() => setAbierto(false), 1200);
      } else {
        setError(d.error ?? "No se pudo enviar.");
      }
    } catch {
      setError("Error de red al enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Generar un seguimiento para retomar esta conversación"
        className="flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
          <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        <span className="hidden lg:inline">Seguimiento</span>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !enviando && setAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-bold tracking-tight">
              Seguimiento de esta conversación
            </h3>
            <p className="mb-3 text-xs text-zinc-500">
              Revisá y editá el mensaje antes de enviarlo. Solo se envía a este contacto.
            </p>

            {cargando ? (
              <div className="flex h-28 items-center justify-center text-sm text-zinc-500">
                Generando borrador…
              </div>
            ) : enviado ? (
              <div className="flex h-28 items-center justify-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Seguimiento enviado
              </div>
            ) : (
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                maxLength={1500}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                placeholder="El borrador aparecerá acá…"
              />
            )}

            {error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            {!enviado && (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  disabled={enviando}
                  className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={enviar}
                  disabled={enviando || cargando || !texto.trim()}
                  className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
