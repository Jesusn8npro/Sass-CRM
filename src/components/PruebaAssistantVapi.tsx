"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";

/**
 * Probar un assistant Vapi desde el browser usando el micrófono
 * (sin gastar minutos de outbound). Usa @vapi-ai/web.
 *
 * Requiere:
 *  - vapiPublicKey: la public key de Vapi (formato sb_pub_... o
 *    UUID legacy). Safe-to-expose en cliente por diseño de Vapi.
 *  - vapiAssistantId: ID del assistant ya creado en Vapi
 *    (devuelto por POST /assistant — guardado en assistants_vapi.vapi_assistant_id).
 */
export function PruebaAssistantVapi({
  vapiPublicKey,
  vapiAssistantId,
  nombreAssistant,
}: {
  vapiPublicKey: string;
  vapiAssistantId: string;
  nombreAssistant: string;
}) {
  const refVapi = useRef<Vapi | null>(null);
  const [estado, setEstado] = useState<"inactivo" | "conectando" | "en_curso" | "error">(
    "inactivo",
  );
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);

  useEffect(() => {
    // Inicializamos Vapi solo en el cliente.
    const v = new Vapi(vapiPublicKey);
    refVapi.current = v;

    v.on("call-start", () => {
      setEstado("en_curso");
      setError(null);
    });
    v.on("call-end", () => {
      setEstado("inactivo");
    });
    v.on("error", (err: unknown) => {
      console.error("[vapi-web] error:", err);
      setEstado("error");
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : JSON.stringify(err);
      setError(msg.slice(0, 300));
    });
    v.on(
      "message",
      (m: { type?: string; role?: string; transcript?: string; transcriptType?: string }) => {
        if (m.type === "transcript" && m.transcriptType === "final" && m.transcript) {
          setTranscript((prev) =>
            [...prev, `${m.role === "user" ? "Vos" : "Agente"}: ${m.transcript}`].slice(
              -10,
            ),
          );
        }
      },
    );

    return () => {
      try {
        v.stop();
      } catch {
        /* noop */
      }
    };
  }, [vapiPublicKey]);

  async function iniciar() {
    if (!refVapi.current) return;
    setEstado("conectando");
    setError(null);
    setTranscript([]);
    try {
      await refVapi.current.start(vapiAssistantId);
    } catch (err) {
      setEstado("error");
      setError(err instanceof Error ? err.message : "Error iniciando");
    }
  }

  function detener() {
    refVapi.current?.stop();
    setEstado("inactivo");
  }

  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Probar con micrófono
      </p>
      <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
        Hablá con <strong>{nombreAssistant}</strong> directo desde el navegador
        sin gastar minutos de outbound. Necesitás permitir el micrófono.
      </p>

      <div className="flex items-center gap-2">
        {estado === "inactivo" || estado === "error" ? (
          <button
            type="button"
            onClick={iniciar}
            className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            <span className="h-2 w-2 rounded-full bg-white" />
            Probar ahora
          </button>
        ) : (
          <button
            type="button"
            onClick={detener}
            className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-400"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            {estado === "conectando" ? "Conectando…" : "En llamada — Cortar"}
          </button>
        )}
        <span className="text-[11px] text-zinc-500">
          {estado === "en_curso" ? "🟢 hablando" : null}
          {estado === "conectando" ? "🟡 conectando" : null}
          {estado === "error" ? "🔴 error" : null}
        </span>
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}

      {transcript.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
          {transcript.map((linea, i) => (
            <p key={i} className="py-0.5">
              {linea}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
