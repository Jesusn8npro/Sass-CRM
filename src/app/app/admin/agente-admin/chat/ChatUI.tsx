"use client";

import { useEffect, useRef, useState } from "react";

interface MensajeChat {
  id: string;
  rol: "usuario" | "asistente" | "humano" | "sistema";
  contenido: string;
  creado_en: string;
  pendiente?: boolean;
}

export function ChatUI() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cargar historial al montar
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/agente-admin/chat");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { mensajes: MensajeChat[] };
        if (!cancelado) setMensajes(j.mensajes ?? []);
      } catch (e) {
        if (!cancelado)
          setError(e instanceof Error ? e.message : "Error cargando historial");
      } finally {
        if (!cancelado) setCargandoHistorial(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Auto-scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, enviando]);

  async function enviar() {
    const texto = borrador.trim();
    if (!texto || enviando) return;
    setBorrador("");
    setError(null);
    setEnviando(true);

    // Mostrar el mensaje del usuario optimistamente
    const tempId = `temp-${Date.now()}`;
    setMensajes((prev) => [
      ...prev,
      {
        id: tempId,
        rol: "usuario",
        contenido: texto,
        creado_en: new Date().toISOString(),
      },
    ]);

    try {
      const r = await fetch("/api/admin/agente-admin/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensaje: texto }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error || `HTTP ${r.status}`);
        return;
      }
      // Agregar la respuesta de Marco
      setMensajes((prev) => [
        ...prev,
        {
          id: `marco-${Date.now()}`,
          rol: "asistente",
          contenido: j.respuesta,
          creado_en: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setEnviando(false);
      // Re-foco al textarea
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter manda, Shift+Enter hace salto de línea
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void enviar();
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
      {/* Historial */}
      <div
        ref={scrollRef}
        className="h-[60vh] min-h-[400px] overflow-y-auto p-5"
      >
        {cargandoHistorial ? (
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            cargando historial…
          </p>
        ) : mensajes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-2xl">👋</p>
            <p className="text-sm text-zinc-600 dark:text-white/55">
              No hay mensajes todavía. Saludá a Marco con un{" "}
              <span className="font-mono">hey parcero</span> o pedile el
              reporte del día.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {mensajes.map((m) => (
              <Burbuja key={m.id} mensaje={m} />
            ))}
            {enviando && (
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  marco está pensando…
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form fijo abajo */}
      <div className="border-t border-zinc-200 p-4 dark:border-white/[0.06]">
        {error && (
          <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 font-mono text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribile a Marco… (Enter envía, Shift+Enter salto de línea)"
            rows={2}
            disabled={enviando || cargandoHistorial}
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white dark:placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!borrador.trim() || enviando}
            className="shrink-0 rounded-full bg-emerald-600 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "…" : "enviar"}
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
          el historial se guarda — podés cerrar la página y volver después
        </p>
      </div>
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: MensajeChat }) {
  const esUsuario = mensaje.rol === "usuario";
  const hora = new Date(mensaje.creado_en).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          esUsuario
            ? "bg-emerald-600 text-white"
            : "bg-zinc-100 text-zinc-900 dark:bg-white/[0.05] dark:text-white"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {mensaje.contenido}
        </p>
        <p
          className={`mt-1 font-mono text-[10px] tracking-wider ${
            esUsuario
              ? "text-white/70"
              : "text-zinc-400 dark:text-white/40"
          }`}
        >
          {hora}
        </p>
      </div>
    </div>
  );
}
