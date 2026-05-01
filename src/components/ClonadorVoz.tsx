"use client";

import { useEffect, useRef, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";

interface Props {
  idCuenta: number;
  onClonada: (cuenta: Cuenta) => void;
}

const MIN_SEGUNDOS = 30;
const MAX_SEGUNDOS = 90;

/**
 * Graba ~1 minuto de audio del usuario y lo manda a ElevenLabs
 * Instant Voice Cloning. El voice_id resultante queda guardado
 * automáticamente como voz de la cuenta.
 *
 * Requisitos prácticos para que la voz suene bien:
 *  - 30-90 segundos de audio limpio (sin música/ruido).
 *  - Tono natural, leyendo varias frases con expresión.
 *  - Habitación silenciosa, micrófono cerca.
 */
export function ClonadorVoz({ idCuenta, onClonada }: Props) {
  const [grabando, setGrabando] = useState(false);
  const [duracion, setDuracion] = useState(0);
  const [blobGrabado, setBlobGrabado] = useState<Blob | null>(null);
  const [nombre, setNombre] = useState("Mi voz");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const refMediaRecorder = useRef<MediaRecorder | null>(null);
  const refStream = useRef<MediaStream | null>(null);
  const refChunks = useRef<Blob[]>([]);
  const refIniciado = useRef<number>(0);
  const refIntervalo = useRef<NodeJS.Timeout | null>(null);
  const refAutoStop = useRef<NodeJS.Timeout | null>(null);

  function detenerStream() {
    refStream.current?.getTracks().forEach((t) => t.stop());
    refStream.current = null;
    if (refIntervalo.current) clearInterval(refIntervalo.current);
    if (refAutoStop.current) clearTimeout(refAutoStop.current);
    refIntervalo.current = null;
    refAutoStop.current = null;
  }

  useEffect(() => {
    return () => detenerStream();
  }, []);

  async function iniciar() {
    setError(null);
    setExito(null);
    setBlobGrabado(null);
    refChunks.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      refStream.current = stream;

      const tipoMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const recorder = tipoMime
        ? new MediaRecorder(stream, { mimeType: tipoMime })
        : new MediaRecorder(stream);
      refMediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) refChunks.current.push(e.data);
      };
      recorder.onstop = () => {
        detenerStream();
        const blob = new Blob(refChunks.current, {
          type: recorder.mimeType || "audio/webm",
        });
        refChunks.current = [];
        if (blob.size > 0) setBlobGrabado(blob);
      };
      recorder.start();
      refIniciado.current = Date.now();
      setDuracion(0);
      setGrabando(true);
      refIntervalo.current = setInterval(() => {
        setDuracion(Math.floor((Date.now() - refIniciado.current) / 1000));
      }, 250);
      // Stop automático al llegar al máximo
      refAutoStop.current = setTimeout(() => {
        if (refMediaRecorder.current?.state === "recording") {
          refMediaRecorder.current.stop();
          setGrabando(false);
          setDuracion(MAX_SEGUNDOS);
        }
      }, MAX_SEGUNDOS * 1000);
    } catch {
      setError(
        "No se pudo acceder al micrófono. Permitilo en la barra del navegador.",
      );
    }
  }

  function detener() {
    if (!grabando) return;
    setGrabando(false);
    try {
      refMediaRecorder.current?.stop();
    } catch {
      // ignorar
    }
  }

  function reiniciar() {
    setBlobGrabado(null);
    setDuracion(0);
    setError(null);
    setExito(null);
  }

  async function enviar() {
    if (enviando) return;
    if (!blobGrabado) {
      setError("No hay grabación.");
      return;
    }
    if (!nombre.trim()) {
      setError("Ponele un nombre a la voz.");
      return;
    }
    if (duracion < MIN_SEGUNDOS) {
      setError(
        `La grabación es muy corta (${duracion}s). Mínimo recomendado: ${MIN_SEGUNDOS}s.`,
      );
      return;
    }
    setEnviando(true);
    setError(null);
    setExito(null);
    try {
      const ext = blobGrabado.type.includes("mp4") ? "m4a" : "webm";
      const archivo = new File([blobGrabado], `voz_${Date.now()}.${ext}`, {
        type: blobGrabado.type,
      });
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("nombre", nombre.trim());
      const res = await fetch(`/api/cuentas/${idCuenta}/voz/clonar`, {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as
        | { voice_id: string; cuenta: Cuenta }
        | { error: string };
      if (!res.ok || !("voice_id" in data)) {
        setError(
          ("error" in data && data.error) ||
            `Error clonando (HTTP ${res.status})`,
        );
        return;
      }
      setExito(
        `✓ Voz clonada. ID: ${data.voice_id} — ya está asignada a la cuenta.`,
      );
      onClonada(data.cuenta);
      setBlobGrabado(null);
      setDuracion(0);
    } catch (err) {
      console.error("[clonador] error:", err);
      setError("Error de red al subir la grabación.");
    } finally {
      setEnviando(false);
    }
  }

  function formatear(s: number): string {
    const mm = Math.floor(s / 60).toString();
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  const urlBlob = blobGrabado ? URL.createObjectURL(blobGrabado) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
          Clonar tu propia voz
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          Grabá entre {MIN_SEGUNDOS} y {MAX_SEGUNDOS} segundos hablando con
          tono natural (frases variadas, silencio de fondo). ElevenLabs crea
          una voz clonada y la asigna a esta cuenta.
        </p>
      </div>

      {!blobGrabado && !grabando && (
        <button
          type="button"
          onClick={iniciar}
          className="self-start rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400"
        >
          🎙 Iniciar grabación
        </button>
      )}

      {grabando && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2">
          <span className="h-2.5 w-2.5 animate-pulso-suave rounded-full bg-red-500" />
          <span className="font-mono text-sm font-semibold text-red-700 dark:text-red-300">
            {formatear(duracion)} / {formatear(MAX_SEGUNDOS)}
          </span>
          <span className="text-xs text-red-700/80 dark:text-red-300/80">
            Hablá con naturalidad...
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={detener}
            disabled={duracion < 3}
            className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Detener
          </button>
        </div>
      )}

      {blobGrabado && urlBlob && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <audio
              src={urlBlob}
              controls
              className="h-10 flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={reiniciar}
              disabled={enviando}
              className="shrink-0 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Regrabar
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            Duración grabada: {formatear(duracion)}.{" "}
            {duracion < MIN_SEGUNDOS && (
              <span className="text-amber-700 dark:text-amber-400">
                Recomendado: ≥{MIN_SEGUNDOS}s para mejor calidad.
              </span>
            )}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Nombre para la voz
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={enviando}
                placeholder="Mi voz"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
            </div>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || duracion < MIN_SEGUNDOS || !nombre.trim()}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Clonando..." : "Clonar voz"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          ✗ {error}
        </div>
      )}
      {exito && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          {exito}
        </div>
      )}
    </div>
  );
}
