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

// Cloudflare Turnstile site key — pública, exponer al cliente está OK.
// Si no está configurada, el widget no se renderiza y el endpoint
// server-side hace bypass del check (rate limit por IP sigue activo).
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface TurnstileWindow extends Window {
  turnstile?: {
    render: (
      el: HTMLElement,
      opts: {
        sitekey: string;
        callback?: (token: string) => void;
        "expired-callback"?: () => void;
        "error-callback"?: () => void;
        size?: "normal" | "compact" | "invisible";
        appearance?: "always" | "execute" | "interaction-only";
      },
    ) => string;
    reset: (widgetId?: string) => void;
    getResponse: (widgetId?: string) => string;
  };
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
  const turnstileTokenRef = useRef<string>("");
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  // Cargar el script de Turnstile una sola vez si la site key está
  // configurada. El widget se renderiza en modo "invisible" — no se
  // ve, pero genera token cuando hace falta.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (typeof window === "undefined") return;
    const w = window as TurnstileWindow;
    if (w.turnstile) {
      renderWidget();
      return;
    }
    const yaCargado = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]',
    );
    if (yaCargado) return;
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);

    function renderWidget() {
      const w2 = window as TurnstileWindow;
      const ts = w2.turnstile;
      if (!ts || !turnstileContainerRef.current) return;
      if (turnstileWidgetIdRef.current) return;
      turnstileWidgetIdRef.current = ts.render(turnstileContainerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "invisible",
        appearance: "interaction-only",
        callback: (token) => {
          turnstileTokenRef.current = token;
        },
        "expired-callback": () => {
          turnstileTokenRef.current = "";
        },
        "error-callback": () => {
          turnstileTokenRef.current = "";
        },
      });
    }
  }, []);

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
          turnstile_token: turnstileTokenRef.current,
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
    <div className="flex h-[62vh] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-[0_0_48px_-12px_rgba(0,0,0,0.8)]">
      {/* Turnstile widget invisible */}
      {TURNSTILE_SITE_KEY && (
        <div ref={turnstileContainerRef} className="hidden" aria-hidden />
      )}

      {/* Header tipo WhatsApp */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-zinc-900/60 px-5 py-3 backdrop-blur-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 font-mono text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/20">
          {nombreAgente.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white">{nombreAgente}</p>
          <div className="flex items-center gap-1.5">
            {escribiendo ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                  escribiendo...
                </span>
              </>
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                en línea
              </span>
            )}
          </div>
        </div>
        {/* Indicador de demo */}
        <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400 sm:inline-flex">
          Demo
        </span>
      </div>

      {/* Cuerpo de mensajes */}
      <div
        ref={cajaRef}
        className="flex-1 space-y-2.5 overflow-y-auto px-4 py-5"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.04), transparent 55%), #09090b",
        }}
      >
        {mensajes.map((m, i) => (
          <Burbuja key={i} rol={m.rol} indice={i}>
            {m.contenido}
          </Burbuja>
        ))}
        {escribiendo && <BurbujaEscribiendo />}
        {error && (
          <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-300/90">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.07] bg-zinc-900/60 px-3 py-3 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Escribí un mensaje..."
            disabled={escribiendo}
            className="min-h-[42px] flex-1 resize-none rounded-2xl border border-white/[0.07] bg-zinc-800/60 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-emerald-400/40 focus:bg-zinc-800/80 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={escribiendo || !input.trim()}
            className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black shadow-[0_0_18px_-4px_rgba(52,211,153,0.5)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_28px_-4px_rgba(52,211,153,0.7)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
  indice,
  children,
}: {
  rol: "user" | "assistant";
  indice: number;
  children: React.ReactNode;
}) {
  const esUsuario = rol === "user";
  // Delay escalonado para mensajes iniciales, sin delay en los nuevos
  const delay = indice < 3 ? `${indice * 60}ms` : "0ms";

  return (
    <div
      className={`flex animate-fade-in-up ${esUsuario ? "justify-end" : "justify-start"}`}
      style={{ animationDelay: delay }}
    >
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm ${
          esUsuario
            ? "rounded-tr-sm bg-emerald-400 text-black"
            : "rounded-tl-sm bg-zinc-800/80 text-white/90 ring-1 ring-white/[0.05]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function BurbujaEscribiendo() {
  return (
    <div className="flex animate-fade-in-up justify-start">
      <div className="rounded-2xl rounded-tl-sm bg-zinc-800/80 px-4 py-3 ring-1 ring-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/70"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/70"
            style={{ animationDelay: "160ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/70"
            style={{ animationDelay: "320ms" }}
          />
        </div>
      </div>
    </div>
  );
}
