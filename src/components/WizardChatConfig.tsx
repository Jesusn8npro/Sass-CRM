"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";

interface Props {
  idCuenta: string;
  abierto: boolean;
  onCerrar: () => void;
  /** Callback cuando el usuario marca como completo — para refrescar la
   *  vista de configuración del agente con los nuevos valores. */
  onCompletado?: () => void;
}

/**
 * Modal con un chat estilo onboarding que va llenando los campos del
 * agente IA llamando tools en el server. Persistencia: el server
 * upsertea el thread en threads_config tras cada turno.
 */
export function WizardChatConfig({
  idCuenta,
  abierto,
  onCerrar,
  onCompletado,
}: Props) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/cuentas/${idCuenta}/config-chat`,
      }),
    [idCuenta],
  );
  const { messages, sendMessage, status } = useChat({
    transport,
    onFinish: () => {
      // Si la última herramienta llamada fue finalizar_configuracion, avisamos
      const ultimo = messages[messages.length - 1];
      const huboFinalizar = ultimo?.parts?.some(
        (p) =>
          p.type === "tool-finalizar_configuracion" &&
          (p as { state?: string }).state === "output-available",
      );
      if (huboFinalizar) onCompletado?.();
    },
  });

  // Mensaje inicial del asistente — solo si el chat está vacío
  useEffect(() => {
    if (abierto && messages.length === 0) {
      sendMessage({ text: "Hola, ayudame a configurar mi agente." });
    }
  }, [abierto, messages.length, sendMessage]);

  // ESC para cerrar
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="flex h-full max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Configurador IA
            </p>
            <h2 className="text-sm font-bold">
              Configurá tu agente conversando
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`min-w-0 max-w-[80%] overflow-hidden rounded-2xl border px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                  }`}
                >
                  {m.parts.map((p, i) => {
                    if (p.type === "text") {
                      return (
                        <p key={i} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {p.text}
                        </p>
                      );
                    }
                    if (p.type.startsWith("tool-")) {
                      const nombre = p.type.replace("tool-", "");
                      return (
                        <p
                          key={i}
                          className="mt-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-300"
                        >
                          ✓ {nombre}
                        </p>
                      );
                    }
                    return null;
                  })}
                </div>
              </li>
            ))}
            {(status === "submitted" || status === "streaming") && (
              <li className="flex justify-start">
                <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  Escribiendo…
                </div>
              </li>
            )}
          </ul>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            sendMessage({ text: input });
            setInput("");
          }}
          className="flex shrink-0 items-end gap-2 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!input.trim()) return;
                sendMessage({ text: input });
                setInput("");
              }
            }}
            rows={1}
            placeholder="Respondé acá…"
            className="min-h-[40px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === "streaming"}
            className="shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
