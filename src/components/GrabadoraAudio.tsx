"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Llamado cuando el usuario suelta el botón después de grabar al menos 0.5s */
  onGrabacionLista: (blob: Blob) => Promise<void>;
  /** Si está procesando una grabación previa, deshabilitar */
  deshabilitado?: boolean;
  /** Notifica al padre el estado de grabación (para ocultar UI alrededor) */
  onEstadoCambio?: (grabando: boolean) => void;
}

export function GrabadoraAudio({
  onGrabacionLista,
  deshabilitado,
  onEstadoCambio,
}: Props) {
  const [grabando, setGrabando] = useState(false);
  const [duracion, setDuracion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const refMediaRecorder = useRef<MediaRecorder | null>(null);
  const refStream = useRef<MediaStream | null>(null);
  const refChunks = useRef<Blob[]>([]);
  const refIniciado = useRef<number>(0);
  const refIntervalo = useRef<NodeJS.Timeout | null>(null);
  const refCancelado = useRef<boolean>(false);

  function detenerStream() {
    if (refStream.current) {
      refStream.current.getTracks().forEach((t) => t.stop());
      refStream.current = null;
    }
    if (refIntervalo.current) {
      clearInterval(refIntervalo.current);
      refIntervalo.current = null;
    }
  }

  useEffect(() => {
    return () => {
      detenerStream();
    };
  }, []);

  async function iniciar() {
    if (grabando || deshabilitado) return;
    setError(null);
    refCancelado.current = false;
    refChunks.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      refStream.current = stream;

      // Preferimos OGG/Opus porque WhatsApp lo trata nativamente como
      // nota de voz. Si no está soportado (Chrome usualmente), caemos
      // a WebM/Opus, que el bot sigue enviando con mimetype audio/ogg.
      const tipoMime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";

      const recorder = tipoMime
        ? new MediaRecorder(stream, { mimeType: tipoMime })
        : new MediaRecorder(stream);
      refMediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) refChunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        detenerStream();
        if (refCancelado.current) {
          refChunks.current = [];
          return;
        }
        const blob = new Blob(refChunks.current, {
          type: recorder.mimeType || "audio/webm",
        });
        refChunks.current = [];
        // Mínimo 0.5s para que no envíe clics accidentales
        if (Date.now() - refIniciado.current < 500 || blob.size < 500) {
          return;
        }
        setProcesando(true);
        try {
          await onGrabacionLista(blob);
        } catch (err) {
          console.error("[grabadora] error subiendo audio:", err);
          setError("Error al enviar el audio");
          setTimeout(() => setError(null), 3000);
        } finally {
          setProcesando(false);
        }
      };

      recorder.start();
      refIniciado.current = Date.now();
      setDuracion(0);
      setGrabando(true);
      onEstadoCambio?.(true);
      refIntervalo.current = setInterval(() => {
        setDuracion(Math.floor((Date.now() - refIniciado.current) / 1000));
      }, 250);
    } catch (err) {
      console.error("[grabadora] no se pudo acceder al micrófono:", err);
      setError("No se pudo acceder al micrófono. Permitilo en el navegador.");
      setTimeout(() => setError(null), 4000);
    }
  }

  function detener(cancelar = false) {
    if (!grabando) return;
    refCancelado.current = cancelar;
    setGrabando(false);
    setDuracion(0);
    onEstadoCambio?.(false);
    try {
      refMediaRecorder.current?.stop();
    } catch {
      // ignorar
    }
  }

  function formatear(s: number): string {
    const mm = Math.floor(s / 60).toString();
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  if (grabando) {
    return (
      <div className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2">
        <button
          type="button"
          onClick={() => detener(true)}
          aria-label="Cancelar grabación"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
        <span className="h-2.5 w-2.5 shrink-0 animate-pulso-suave rounded-full bg-red-500" />
        <span className="shrink-0 font-mono text-sm font-semibold text-red-700 dark:text-red-300">
          {formatear(duracion)}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="block w-0.5 shrink-0 rounded-full bg-red-500/60"
              style={{
                height: `${20 + Math.abs(Math.sin((duracion * 4 + i) / 2)) * 60}%`,
                animation: "pulso-suave 1s ease-in-out infinite",
                animationDelay: `${i * 40}ms`,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => detener(false)}
          aria-label="Enviar grabación"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-colors hover:bg-red-400"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={iniciar}
        disabled={deshabilitado || procesando}
        title="Grabar nota de voz"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-zinc-950 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {procesando ? (
          <span className="h-2 w-2 animate-pulso-suave rounded-full bg-zinc-950" />
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
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M19 10a7 7 0 0 1-14 0" />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
          </svg>
        )}
      </button>
      {error && (
        <span className="absolute bottom-full left-0 mb-1 rounded-md bg-red-500 px-2 py-1 text-[10px] text-white">
          {error}
        </span>
      )}
    </>
  );
}
