"use client";

import { useEffect, useRef, useState } from "react";

interface Mensaje {
  rol: "user" | "assistant";
  contenido: string;
}

interface Props {
  idIndustria: string;
  nombreAgente: string;
  mensajeBienvenida: string;
}

/**
 * Chat sandbox del demo. Estado en memoria; al refrescar se pierde
 * (intencional para un demo público).
 */
export function ChatDemo({ idIndustria, nombreAgente, mensajeBienvenida }: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: "assistant", contenido: mensajeBienvenida },
  ]);
  const [input, setInput] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cajaRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll al final cuando llega un mensaje nuevo o cuando aparece
  // el indicador de escribiendo.
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
      // Pequeña espera artificial para que el "escribiendo..." se
      // perciba antes de la primera respuesta de OpenAI.
      const espera = new Promise((r) => setTimeout(r, 1000));

      const resPromise = fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idIndustria,
          historial: mensajes,
          nuevoMensaje: texto,
        }),
      });

      const [res] = await Promise.all([resPromise, espera]);
      const data = (await res.json()) as { respuesta?: string; error?: string };

      if (!res.ok) {
        const msg = data.error ?? "No pudimos generar la respuesta";
        setError(msg);
        return;
      }
      const respuesta = (data.respuesta ?? "").trim();
      if (!respuesta) {
        setError("Respuesta vacía del agente");
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
    <div className="flex h-[60vh] min-h-[480px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A]">
      {/* Header tipo whatsapp */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-black/40 px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-[11px] font-semibold text-emerald-300">
          {nombreAgente.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white">{nombreAgente}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
            {escribiendo ? "escribiendo..." : "en línea"}
          </p>
        </div>
      </div>

      {/* Cuerpo de mensajes */}
      <div
        ref={cajaRef}
        className="flex-1 space-y-2 overflow-y-auto bg-[#0A0A0A] px-4 py-4"
      >
        {mensajes.map((m, i) => (
          <Burbuja key={i} rol={m.rol}>
            {m.contenido}
          </Burbuja>
        ))}
        {escribiendo && <BurbujaEscribiendo />}
        {error && (
          <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] bg-black/40 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Escribí un mensaje..."
            disabled={escribiendo}
            className="min-h-[42px] flex-1 resize-none rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-emerald-400/40 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={escribiendo || !input.trim()}
            className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enviar
          </button>
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
        className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${
          esUsuario
            ? "bg-emerald-400 text-black"
            : "bg-white/[0.06] text-white/90"
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
      <div className="rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
