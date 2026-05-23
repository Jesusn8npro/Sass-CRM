"use client";

import { useEffect, useRef, useState } from "react";

interface Mensaje {
  rol: "user" | "assistant";
  contenido: string;
}

const MENSAJE_BIENVENIDA =
  "¡Hola! 👋 Soy el asistente de soporte de INYECTAIA. ¿En qué puedo ayudarte? Podés preguntarme sobre cómo usar la plataforma, configurar tu agente, importar productos, planes, troubleshooting, etc.";

/**
 * Chat de soporte con un asistente IA que conoce el producto. Estado en
 * memoria — al refrescar la página se pierde la conversación (intencional).
 */
export function ChatSoporte({ idCuenta }: { idCuenta: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: "assistant", contenido: MENSAJE_BIENVENIDA },
  ]);
  const [input, setInput] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cajaRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll cuando llega un mensaje nuevo o aparece el indicador.
  useEffect(() => {
    const c = cajaRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [mensajes, escribiendo]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || escribiendo) return;
    setError(null);
    setInput("");
    const nuevoUsuario: Mensaje = { rol: "user", contenido: texto };
    setMensajes((prev) => [...prev, nuevoUsuario]);
    setEscribiendo(true);

    try {
      const espera = new Promise((r) => setTimeout(r, 600));
      const resPromise = fetch(
        `/api/cuentas/${idCuenta}/soporte/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            historial: mensajes,
            nuevoMensaje: texto,
          }),
        },
      );
      const [res] = await Promise.all([resPromise, espera]);
      const data = (await res.json()) as { respuesta?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? "No pudimos generar la respuesta");
        return;
      }
      const respuesta = (data.respuesta ?? "").trim();
      if (!respuesta) {
        setError("Respuesta vacía del asistente");
        return;
      }
      setMensajes((prev) => [
        ...prev,
        { rol: "assistant", contenido: respuesta },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setEscribiendo(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50/50 dark:bg-zinc-950">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-3 py-4 md:px-6 md:py-6">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header tipo WhatsApp */}
          <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm">
              S
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                Asistente de soporte
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    escribiendo
                      ? "bg-amber-400 animate-pulse"
                      : "bg-emerald-500"
                  }`}
                />
                {escribiendo ? "escribiendo..." : "en línea"}
              </p>
            </div>
          </div>

          {/* Cuerpo de mensajes */}
          <div
            ref={cajaRef}
            className="flex-1 space-y-2 overflow-y-auto bg-zinc-50/80 px-3 py-4 dark:bg-zinc-950 md:px-5"
          >
            {mensajes.map((m, i) => (
              <Burbuja key={i} rol={m.rol}>
                {m.contenido}
              </Burbuja>
            ))}
            {escribiendo && <BurbujaEscribiendo />}
            {error && (
              <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/[0.08] dark:text-red-300">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Escribí tu pregunta..."
                disabled={escribiendo}
                className="min-h-[42px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={enviar}
                disabled={escribiendo || !input.trim()}
                className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
              Las conversaciones no se guardan — al recargar la página se pierde el historial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Burbuja({
  rol,
  children,
}: {
  rol: "user" | "assistant";
  children: React.ReactNode;
}) {
  const esUsuario = rol === "user";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm ${
          esUsuario
            ? "bg-emerald-600 text-white"
            : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function BurbujaEscribiendo() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-sm dark:bg-zinc-800">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms] dark:bg-zinc-500" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:120ms] dark:bg-zinc-500" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:240ms] dark:bg-zinc-500" />
        </div>
      </div>
    </div>
  );
}
