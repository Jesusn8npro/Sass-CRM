"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  vozId: string;
  /** Estilo: "pill" para inline en pills, "icon" para botón cuadrado al lado de input */
  variante?: "pill" | "icon";
}

/**
 * Botón ▶ que descarga la metadata de una voz de ElevenLabs y
 * reproduce su preview MP3. Cero costo de créditos. Cachea el
 * preview_url en memoria para no consultar dos veces.
 */
export function BotonReproducirVoz({ vozId, variante = "icon" }: Props) {
  const [estado, setEstado] = useState<
    "inicial" | "cargando" | "reproduciendo" | "error"
  >("inicial");
  const refAudio = useRef<HTMLAudioElement | null>(null);
  const refUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      refAudio.current?.pause();
      refAudio.current = null;
    };
  }, []);

  // Resetear si cambia el vozId
  useEffect(() => {
    refAudio.current?.pause();
    refAudio.current = null;
    refUrl.current = null;
    setEstado("inicial");
  }, [vozId]);

  async function reproducir() {
    if (!vozId.trim()) return;
    if (estado === "reproduciendo") {
      refAudio.current?.pause();
      setEstado("inicial");
      return;
    }
    setEstado("cargando");
    try {
      let url = refUrl.current;
      if (!url) {
        const res = await fetch(
          `/api/elevenlabs/voz/${encodeURIComponent(vozId.trim())}/preview`,
        );
        if (!res.ok) {
          setEstado("error");
          setTimeout(() => setEstado("inicial"), 2500);
          return;
        }
        const data = (await res.json()) as { preview_url: string | null };
        if (!data.preview_url) {
          setEstado("error");
          setTimeout(() => setEstado("inicial"), 2500);
          return;
        }
        url = data.preview_url;
        refUrl.current = url;
      }
      const audio = new Audio(url);
      refAudio.current = audio;
      audio.onended = () => setEstado("inicial");
      audio.onpause = () => {
        if (audio.currentTime >= audio.duration) setEstado("inicial");
      };
      audio.onerror = () => {
        setEstado("error");
        setTimeout(() => setEstado("inicial"), 2500);
      };
      await audio.play();
      setEstado("reproduciendo");
    } catch (err) {
      console.error("[BotonReproducir] error:", err);
      setEstado("error");
      setTimeout(() => setEstado("inicial"), 2500);
    }
  }

  const baseClases =
    variante === "pill"
      ? "flex h-5 w-5 items-center justify-center rounded-full"
      : "flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800";

  const colorClases =
    estado === "error"
      ? "bg-red-500/15 text-red-700 dark:text-red-300"
      : estado === "reproduciendo"
      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";

  return (
    <button
      type="button"
      onClick={reproducir}
      disabled={!vozId.trim() || estado === "cargando"}
      title={
        estado === "reproduciendo"
          ? "Pausar"
          : estado === "error"
          ? "No se pudo reproducir"
          : "Escuchar voz"
      }
      className={`${baseClases} ${colorClases} transition-colors disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {estado === "cargando" ? (
        <span className="h-1.5 w-1.5 animate-pulso-suave rounded-full bg-current" />
      ) : estado === "reproduciendo" ? (
        // Pause icon
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={variante === "pill" ? "h-3 w-3" : "h-4 w-4"}
        >
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        // Play icon
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={variante === "pill" ? "h-3 w-3" : "h-4 w-4"}
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
