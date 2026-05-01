"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Conversacion,
  Cuenta,
  Mensaje,
  ModoConversacion,
  RespuestaRapida,
} from "@/lib/baseDatos";
import { BurbujaMensaje } from "./BurbujaMensaje";
import { InterruptorModo } from "./InterruptorModo";
import { SelectorEmoji } from "./SelectorEmoji";
import { GrabadoraAudio } from "./GrabadoraAudio";
import { SelectorEtiquetas } from "./SelectorEtiquetas";
import { BotonLlamar } from "./BotonLlamar";

interface Props {
  idCuenta: number;
  idConversacion: number;
  cuenta: Cuenta;
  onConversacionBorrada: (id: number) => void;
}

interface RespuestaMensajes {
  conversacion: Conversacion;
  mensajes: Mensaje[];
}

export function PanelConversacion({
  idCuenta,
  idConversacion,
  cuenta,
  onConversacionBorrada,
}: Props) {
  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [subiendoMedia, setSubiendoMedia] = useState(false);
  const [errorMedia, setErrorMedia] = useState<string | null>(null);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState(false);
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([]);
  const refScroll = useRef<HTMLDivElement>(null);
  const refInputArchivo = useRef<HTMLInputElement>(null);
  const refTextarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelado = false;
    const url = `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`;

    async function cargar() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as RespuestaMensajes;
        if (cancelado) return;
        setConversacion(data.conversacion);
        setMensajes(data.mensajes);
      } catch {
        // ignorar
      }
    }

    cargar();
    const intervalo = setInterval(cargar, 2000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [idCuenta, idConversacion]);

  useEffect(() => {
    const el = refScroll.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mensajes.length]);

  useEffect(() => {
    setConfirmandoBorrado(false);
    setBorrador("");
    setEmojiAbierto(false);
    setRespuestasAbiertas(false);
  }, [idConversacion]);

  // Cargar respuestas rápidas de la cuenta una vez
  useEffect(() => {
    let cancelado = false;
    fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { respuestas: RespuestaRapida[] } | null) => {
        if (!cancelado && data) setRespuestas(data.respuestas);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [idCuenta]);

  function insertarEnTextarea(texto: string) {
    const el = refTextarea.current;
    if (!el) {
      setBorrador((b) => b + texto);
      return;
    }
    const inicio = el.selectionStart ?? borrador.length;
    const fin = el.selectionEnd ?? borrador.length;
    const nuevo = borrador.slice(0, inicio) + texto + borrador.slice(fin);
    setBorrador(nuevo);
    // Reposicionar cursor al final del texto insertado
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(inicio + texto.length, inicio + texto.length);
    }, 0);
  }

  const subirAudioVoz = useCallback(
    async (blob: Blob) => {
      const archivo = new File(
        [blob],
        `voz_${Date.now()}.${blob.type.includes("ogg") ? "ogg" : "webm"}`,
        { type: blob.type || "audio/webm" },
      );
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("caption", "");
      const res = await fetch(
        `/api/cuentas/${idCuenta}/mensajes/${idConversacion}/multimedia`,
        { method: "POST", body: formData },
      );
      if (res.ok) {
        const recargar = await fetch(
          `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
          { cache: "no-store" },
        );
        if (recargar.ok) {
          const data = (await recargar.json()) as RespuestaMensajes;
          setMensajes(data.mensajes);
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    },
    [idCuenta, idConversacion],
  );

  function actualizarModo(nuevo: ModoConversacion) {
    setConversacion((prev) => (prev ? { ...prev, modo: nuevo } : prev));
  }

  async function enviarMensajeHumano() {
    const texto = borrador.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenido: texto }),
        },
      );
      if (res.ok) {
        setBorrador("");
        const recargar = await fetch(
          `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
          { cache: "no-store" },
        );
        if (recargar.ok) {
          const data = (await recargar.json()) as RespuestaMensajes;
          setConversacion(data.conversacion);
          setMensajes(data.mensajes);
        }
      }
    } finally {
      setEnviando(false);
    }
  }

  async function subirArchivo(archivo: File) {
    if (subiendoMedia) return;
    setSubiendoMedia(true);
    setErrorMedia(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("caption", borrador.trim());
      const res = await fetch(
        `/api/cuentas/${idCuenta}/mensajes/${idConversacion}/multimedia`,
        { method: "POST", body: formData },
      );
      if (res.ok) {
        setBorrador("");
        const recargar = await fetch(
          `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
          { cache: "no-store" },
        );
        if (recargar.ok) {
          const data = (await recargar.json()) as RespuestaMensajes;
          setMensajes(data.mensajes);
        }
      } else {
        // Mostrar error legible al usuario
        if (res.status === 413) {
          setErrorMedia(
            `El archivo es demasiado grande. Máximo 50MB.`,
          );
        } else {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setErrorMedia(data.error ?? `Error subiendo (HTTP ${res.status}).`);
        }
        setTimeout(() => setErrorMedia(null), 5000);
      }
    } catch (err) {
      console.error("[panel] error subiendo:", err);
      setErrorMedia("Error de red al subir el archivo.");
      setTimeout(() => setErrorMedia(null), 5000);
    } finally {
      setSubiendoMedia(false);
      if (refInputArchivo.current) refInputArchivo.current.value = "";
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conversaciones/${idConversacion}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onConversacionBorrada(idConversacion);
      }
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  }

  if (!conversacion) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-2 w-2 animate-pulso-suave rounded-full bg-zinc-400 dark:bg-zinc-600" />
          Cargando conversación...
        </div>
      </div>
    );
  }

  const esIA = conversacion.modo === "IA";

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 bg-white/70 px-3 py-3 backdrop-blur-md md:flex-row md:items-center md:justify-between md:gap-4 md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-zinc-900 md:text-base dark:text-zinc-100">
            {conversacion.nombre ?? `+${conversacion.telefono}`}
          </h2>
          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
            +{conversacion.telefono}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <BotonLlamar
            cuenta={cuenta}
            telefono={conversacion.telefono}
            nombre={conversacion.nombre}
          />
          <SelectorEtiquetas
            idCuenta={idCuenta}
            idConversacion={conversacion.id}
          />
          <InterruptorModo
            idCuenta={idCuenta}
            idConversacion={conversacion.id}
            modo={conversacion.modo}
            onCambio={actualizarModo}
          />
          {confirmandoBorrado ? (
            <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-1">
              <span className="px-2 text-[11px] text-red-700 dark:text-red-300">
                ¿Seguro?
              </span>
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(false)}
                className="rounded-full px-2 py-1 text-[11px] text-zinc-500"
              >
                No
              </button>
              <button
                type="button"
                onClick={borrar}
                disabled={borrando}
                className="rounded-full bg-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50 dark:text-red-300"
              >
                {borrando ? "..." : "Sí"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 md:text-xs dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-red-300"
            >
              Borrar
            </button>
          )}
        </div>
      </header>

      <div ref={refScroll} className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
        {mensajes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-600">
              Sin mensajes en esta conversación.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mensajes.map((m) => (
              <BurbujaMensaje key={m.id} mensaje={m} idCuenta={idCuenta} />
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-zinc-200 bg-white/70 px-3 py-3 backdrop-blur-md md:px-6 md:py-4 dark:border-zinc-800 dark:bg-zinc-950/60">
        {errorMedia && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {errorMedia}
          </div>
        )}
        {esIA ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <span className="h-1.5 w-1.5 animate-pulso-suave rounded-full bg-emerald-500" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200/80">
              El bot responde automáticamente. Cambia a Humano para escribir
              tú.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarMensajeHumano();
            }}
            className="relative flex items-end gap-2"
          >
            <input
              ref={refInputArchivo}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subirArchivo(f);
              }}
            />

            {/* Píldora estilo WhatsApp: emoji + textarea + clip + respuestas */}
            <div className="flex flex-1 items-end gap-1 rounded-3xl border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/60">
              {/* Emoji a la izquierda dentro de la píldora */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setEmojiAbierto((v) => !v);
                    setRespuestasAbiertas(false);
                  }}
                  title="Insertar emoji"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </button>
                <SelectorEmoji
                  abierto={emojiAbierto}
                  onCerrar={() => setEmojiAbierto(false)}
                  onSeleccionar={(e) => {
                    insertarEnTextarea(e);
                  }}
                />
              </div>

              <textarea
                ref={refTextarea}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarMensajeHumano();
                  }
                }}
                rows={1}
                placeholder="Mensaje"
                className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />

              {/* Respuestas rápidas dentro de la píldora */}
              {respuestas.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setRespuestasAbiertas((v) => !v);
                      setEmojiAbierto(false);
                    }}
                    title="Respuestas rápidas"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </button>
                  {respuestasAbiertas && (
                    <DropdownRespuestas
                      respuestas={respuestas}
                      onSeleccionar={(texto) => {
                        setBorrador(texto);
                        setRespuestasAbiertas(false);
                        setTimeout(() => refTextarea.current?.focus(), 0);
                      }}
                      onCerrar={() => setRespuestasAbiertas(false)}
                    />
                  )}
                </div>
              )}

              {/* Adjuntar archivo dentro de la píldora */}
              <button
                type="button"
                onClick={() => refInputArchivo.current?.click()}
                disabled={subiendoMedia}
                title="Adjuntar imagen, video, audio o PDF"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {subiendoMedia ? (
                  <span className="h-2 w-2 animate-pulso-suave rounded-full bg-amber-500" />
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8l-8.57 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                )}
              </button>
            </div>

            {/* Botón circular: micrófono cuando está vacío, enviar cuando hay texto */}
            {borrador.trim() ? (
              <button
                type="submit"
                disabled={enviando}
                aria-label="Enviar mensaje"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-zinc-950 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            ) : (
              <GrabadoraAudio
                onGrabacionLista={subirAudioVoz}
                deshabilitado={subiendoMedia}
              />
            )}
          </form>
        )}
      </footer>
    </div>
  );
}

function DropdownRespuestas({
  respuestas,
  onSeleccionar,
  onCerrar,
}: {
  respuestas: RespuestaRapida[];
  onSeleccionar: (texto: string) => void;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function alClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCerrar();
    }
    const t = setTimeout(() => {
      document.addEventListener("mousedown", alClick);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", alClick);
    };
  }, [onCerrar]);
  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-2 w-[320px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Respuestas rápidas
        </p>
      </div>
      <ul className="max-h-[280px] overflow-y-auto py-1">
        {respuestas.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(r.texto)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {r.atajo}
              </span>
              <span className="line-clamp-2 text-xs text-zinc-700 dark:text-zinc-300">
                {r.texto}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
