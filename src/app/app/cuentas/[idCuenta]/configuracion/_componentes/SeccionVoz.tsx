"use client";

import { useCallback, useEffect, useState } from "react";
import { BotonReproducirVoz } from "@/components/BotonReproducirVoz";
import { ClonadorVoz } from "@/components/ClonadorVoz";
import {
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
} from "./compartido";

const VOCES_DEFAULT = [
  { nombre: "Sarah (mujer)", id: "EXAVITQu4vr4xnSDxMaL" },
  { nombre: "Aria (mujer)", id: "9BWtsMINqrJLrRacOk9x" },
  { nombre: "Rachel (mujer)", id: "21m00Tcm4TlvDq8ikWAM" },
  { nombre: "Adam (hombre)", id: "pNInz6obpgDQGcFmaJgB" },
  { nombre: "Antoni (hombre)", id: "ErXwobaYiN019PkySvjV" },
];

export function SeccionVoz({ cuenta, onActualizada }: PropsSeccionBase) {
  const [voz, setVoz] = useState(cuenta.voz_elevenlabs ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [vocesPersonales, setVocesPersonales] = useState<
    Array<{ voice_id: string; name: string; category: string }>
  >([]);
  const [cargandoVoces, setCargandoVoces] = useState(false);
  const [errorVoces, setErrorVoces] = useState<string | null>(null);

  const cargarVoces = useCallback(async () => {
    setCargandoVoces(true);
    setErrorVoces(null);
    try {
      const res = await fetch("/api/elevenlabs/voces", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as
        | {
            voces: Array<{
              voice_id: string;
              name: string;
              category: string;
            }>;
          }
        | { error: string };
      if (res.ok && "voces" in data) {
        // Mostramos todas las voces que NO son premade default. Eso
        // incluye: cloned (IVC), professional (PVC), generated (Voice
        // Designer) y famous. Así aparecen también las que agregaste
        // desde la Voice Library de ElevenLabs.
        const personales = data.voces.filter((v) => v.category !== "premade");
        setVocesPersonales(personales);
      } else {
        setErrorVoces(
          ("error" in data && data.error) ||
            `No se pudieron listar voces (HTTP ${res.status})`,
        );
      }
    } catch (err) {
      setErrorVoces(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCargandoVoces(false);
    }
  }, []);

  useEffect(() => {
    setVoz(cuenta.voz_elevenlabs ?? "");
    setError(null);
    setExito(false);
    cargarVoces();
  }, [cuenta.id, cargarVoces]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const limpio = voz.trim();
    const r = await patchCuenta(cuenta.id, {
      voz_elevenlabs: limpio.length > 0 ? limpio : null,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  const activado = !!cuenta.voz_elevenlabs?.trim();

  return (
    <Tarjeta
      titulo="Voz (ElevenLabs)"
      descripcion="Modo espejo: el agente responde en nota de voz SOLO cuando el cliente le envía un audio. Si el cliente escribe, el agente responde con texto multi-parte (no quema créditos de voz innecesario). Necesita ELEVENLABS_API_KEY en .env.local."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <Etiqueta>Voice ID de ElevenLabs</Etiqueta>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={voz}
              onChange={(e) => setVoz(e.target.value)}
              placeholder="Ej: 21m00Tcm4TlvDq8ikWAM (o vacío para texto)"
              className={`${inputClases()} font-mono text-xs flex-1`}
            />
            <BotonReproducirVoz vozId={voz} variante="icon" />
          </div>

          {/* Voces personales: cloned, professional, generated, famous.
              Cualquier cosa que no sea premade default. */}
          {vocesPersonales.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Tus voces ({vocesPersonales.length})
                </p>
                <button
                  type="button"
                  onClick={cargarVoces}
                  disabled={cargandoVoces}
                  title="Recargar lista"
                  className="text-[11px] text-emerald-700 underline disabled:opacity-50 dark:text-emerald-400"
                >
                  {cargandoVoces ? "..." : "Recargar"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vocesPersonales.map((v) => {
                  const seleccionada = voz.trim() === v.voice_id;
                  const etiquetaCat =
                    v.category === "cloned"
                      ? "clonada"
                      : v.category === "professional"
                      ? "PVC"
                      : v.category === "generated"
                      ? "diseñada"
                      : v.category === "famous"
                      ? "famosa"
                      : v.category;
                  return (
                    <div
                      key={v.voice_id}
                      className={`flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 transition-colors ${
                        seleccionada
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                          : "border-emerald-500/40 bg-white text-emerald-800 hover:bg-emerald-500/5 dark:border-emerald-500/40 dark:bg-zinc-900 dark:text-emerald-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setVoz(v.voice_id)}
                        className="flex items-baseline gap-1.5 text-[11px]"
                      >
                        <span>{v.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/60">
                          {etiquetaCat}
                        </span>
                      </button>
                      <BotonReproducirVoz vozId={v.voice_id} variante="pill" />
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">
                💡 El preview ▶ a veces suena en inglés (es un MP3 fijo de
                ElevenLabs). Cuando el bot responde a un cliente, le pasa
                texto en español al modelo y usa esta voz — sí responderá
                en español con su acento.
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Voces default (gratis con plan free)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VOCES_DEFAULT.map((v) => {
                const seleccionada = voz.trim() === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 transition-colors ${
                      seleccionada
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setVoz(v.id)}
                      className="font-mono text-[11px]"
                    >
                      {v.nombre}
                    </button>
                    <BotonReproducirVoz vozId={v.id} variante="pill" />
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
              Tip: tocá ▶ al lado de cada nombre para escuchar la voz antes
              de elegirla. Las voces de tu <em>biblioteca personal</em>{" "}
              requieren plan pago.
            </p>
          </div>

          {errorVoces && (
            <p className="mt-2 text-[11px] text-red-700 dark:text-red-300">
              No se pudieron listar tus voces clonadas: {errorVoces}
            </p>
          )}

          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cómo obtener otras voces:{" "}
            <a
              href="https://elevenlabs.io/app/voice-library"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              elevenlabs.io/app/voice-library
            </a>{" "}
            → elegí una voz → copiá el "Voice ID".
            <br />
            <strong className="text-zinc-700 dark:text-zinc-300">Vacío</strong>{" "}
            = nunca usa voz, siempre responde con texto.
            <br />
            <strong className="text-zinc-700 dark:text-zinc-300">Lleno</strong>{" "}
            = modo espejo activo. Si el cliente envía audio, el agente
            responde con audio (esa voz). Si el cliente escribe texto, el
            agente responde con texto.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">
            Estado:{" "}
            {activado ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Espejo activo
              </span>
            ) : (
              <span className="font-semibold">Solo texto</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <MensajeEstado exito={exito} error={error} />
            {botonGuardar({ guardando })}
          </div>
        </div>

        <ClonadorVoz
          idCuenta={cuenta.id}
          onClonada={(c) => {
            onActualizada(c);
            // Refresca la lista para que aparezca como pill al toque
            cargarVoces();
          }}
        />
      </form>
    </Tarjeta>
  );
}
