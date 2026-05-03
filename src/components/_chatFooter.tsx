"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { RespuestaRapida } from "@/lib/baseDatos";
import { GrabadoraAudio } from "./GrabadoraAudio";
import { SelectorEmoji } from "./SelectorEmoji";

export function ChatFooter({
  esIA,
  errorMedia,
  borrador,
  setBorrador,
  emojiAbierto,
  setEmojiAbierto,
  respuestasAbiertas,
  setRespuestasAbiertas,
  respuestas,
  refTextarea,
  refInputArchivo,
  enviarMensajeHumano,
  insertarEnTextarea,
  subirArchivo,
  subirAudioVoz,
  subiendoMedia,
  enviando,
}: {
  esIA: boolean;
  errorMedia: string | null;
  borrador: string;
  setBorrador: (v: string) => void;
  emojiAbierto: boolean;
  setEmojiAbierto: (f: (v: boolean) => boolean) => void;
  respuestasAbiertas: boolean;
  setRespuestasAbiertas: (f: ((v: boolean) => boolean) | boolean) => void;
  respuestas: RespuestaRapida[];
  refTextarea: RefObject<HTMLTextAreaElement | null>;
  refInputArchivo: RefObject<HTMLInputElement | null>;
  enviarMensajeHumano: () => void;
  insertarEnTextarea: (texto: string) => void;
  subirArchivo: (f: File) => void;
  subirAudioVoz: (b: Blob) => Promise<void>;
  subiendoMedia: boolean;
  enviando: boolean;
}) {
  const [grabandoAudio, setGrabandoAudio] = useState(false);
  return (
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
            El bot responde automáticamente. Cambia a Humano para escribir tú.
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

          <div
            className={`${
              grabandoAudio ? "hidden" : "flex"
            } flex-1 items-end gap-1 rounded-3xl border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900/60`}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setEmojiAbierto((v: boolean) => !v);
                  setRespuestasAbiertas(false);
                }}
                title="Insertar emoji"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
              <SelectorEmoji
                abierto={emojiAbierto}
                onCerrar={() => setEmojiAbierto(() => false)}
                onSeleccionar={(e) => insertarEnTextarea(e)}
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

            {respuestas.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setRespuestasAbiertas((v: boolean) => !v);
                    setEmojiAbierto(() => false);
                  }}
                  title="Respuestas rápidas"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8l-8.57 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              )}
            </button>
          </div>

          {borrador.trim() && !grabandoAudio ? (
            <button
              type="submit"
              disabled={enviando}
              aria-label="Enviar mensaje"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-zinc-950 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <GrabadoraAudio
              onGrabacionLista={subirAudioVoz}
              deshabilitado={subiendoMedia}
              onEstadoCambio={setGrabandoAudio}
            />
          )}
        </form>
      )}
    </footer>
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
