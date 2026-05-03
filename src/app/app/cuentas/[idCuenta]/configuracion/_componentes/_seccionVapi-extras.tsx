"use client";

import type { Cuenta } from "@/lib/baseDatos";
import { Etiqueta, inputClases } from "./compartido";

export interface EstadoVapiInfo {
  publicKey: string | null;
  phoneNumberId: string | null;
  configurado: boolean;
  origenes: {
    api_key: "cuenta" | "env" | "ninguno";
    public_key: "cuenta" | "env" | "ninguno";
    phone_id: "cuenta" | "env" | "ninguno";
  };
}

function ItemEstado({ activo, texto }: { activo: boolean; texto: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${activo ? "bg-emerald-500" : "bg-zinc-400"}`}
      />
      <span className={activo ? "" : "text-zinc-500"}>{texto}</span>
    </li>
  );
}

export function ConfigAvanzadaVapi({
  cuenta,
  avanzadoAbierto,
  setAvanzadoAbierto,
  promptExtra,
  setPromptExtra,
  primerMensaje,
  setPrimerMensaje,
  maxSegundos,
  setMaxSegundos,
  grabar,
  setGrabar,
}: {
  cuenta: Cuenta;
  avanzadoAbierto: boolean;
  setAvanzadoAbierto: (f: (v: boolean) => boolean) => void;
  promptExtra: string;
  setPromptExtra: (v: string) => void;
  primerMensaje: string;
  setPrimerMensaje: (v: string) => void;
  maxSegundos: number;
  setMaxSegundos: (v: number) => void;
  grabar: boolean;
  setGrabar: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setAvanzadoAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300"
      >
        <span>Configuración avanzada de la llamada</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 transition-transform ${avanzadoAbierto ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {avanzadoAbierto && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
          <div>
            <Etiqueta>Instrucciones extra para llamadas (opcional)</Etiqueta>
            <textarea
              value={promptExtra}
              onChange={(e) => setPromptExtra(e.target.value)}
              rows={5}
              placeholder="Ej: Cuando hables por teléfono, hablá más despacio. Si el cliente pregunta por precios, mencioná que el plan estándar arranca en cien mil pesos. Cerrá agendando una demo el viernes."
              className={`${inputClases()} text-xs leading-relaxed`}
            />
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Esto se appendea al prompt principal SOLO para llamadas. Útil para
              tono distinto, datos que solo decís hablando, o cierre específico
              telefónico. Vacío = solo se usa el prompt principal.
            </p>
          </div>

          <div>
            <Etiqueta>Primer mensaje de la llamada (opcional)</Etiqueta>
            <input
              type="text"
              value={primerMensaje}
              onChange={(e) => setPrimerMensaje(e.target.value)}
              placeholder={`Hola, te llamo de ${cuenta.etiqueta}. ¿Tenés un momento?`}
              className={`${inputClases()} text-xs`}
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Lo que dice el agente al contestar. Si está vacío, se usa un saludo
              default con el nombre de la cuenta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Etiqueta>Duración máxima (segundos)</Etiqueta>
              <input
                type="number"
                value={maxSegundos}
                onChange={(e) =>
                  setMaxSegundos(
                    Math.max(30, Math.min(3600, Number(e.target.value) || 600)),
                  )
                }
                min={30}
                max={3600}
                className={`${inputClases()} text-xs`}
              />
              <p className="mt-1 text-[10px] text-zinc-500">
                30-3600s. Default 600 (10 min).
              </p>
            </div>
            <div>
              <Etiqueta>Grabar llamadas</Etiqueta>
              <label className="mt-1 flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 dark:border-zinc-800">
                <input
                  type="checkbox"
                  checked={grabar}
                  onChange={(e) => setGrabar(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                  {grabar ? "Sí" : "No"} (afecta privacidad)
                </span>
              </label>
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
            ⚠ Tras cambiar estos campos, hacé click en{" "}
            <strong>Resincronizar assistant</strong> abajo para que Vapi tome los
            nuevos valores.
          </p>
        </div>
      )}
    </div>
  );
}

export function EstadoSincronizarVapi({
  cuenta,
  estadoVapi,
  tieneApiKey,
  tienePhone,
  tieneVoz,
  tieneAssistant,
  todoListo,
  sincronizar,
  sincronizando,
  resultadoSync,
}: {
  cuenta: Cuenta;
  estadoVapi: EstadoVapiInfo | null;
  tieneApiKey: boolean;
  tienePhone: boolean;
  tieneVoz: boolean;
  tieneAssistant: boolean;
  todoListo: boolean;
  sincronizar: () => void;
  sincronizando: boolean;
  resultadoSync: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Estado
      </p>
      <ul className="flex flex-col gap-1 text-[12px] text-zinc-700 dark:text-zinc-300">
        <ItemEstado
          activo={tieneApiKey}
          texto={
            "API key configurada" +
            (estadoVapi?.origenes.api_key === "env"
              ? " (desde sistema .env)"
              : estadoVapi?.origenes.api_key === "cuenta"
              ? " (override per-cuenta)"
              : "")
          }
        />
        <ItemEstado
          activo={tienePhone}
          texto={
            "Phone Number ID configurado" +
            (estadoVapi?.origenes.phone_id === "env"
              ? " (desde sistema .env)"
              : estadoVapi?.origenes.phone_id === "cuenta"
              ? " (override per-cuenta)"
              : "")
          }
        />
        <ItemEstado activo={tieneVoz} texto="Voice ID de ElevenLabs (sección Voz)" />
        <ItemEstado
          activo={tieneAssistant}
          texto={
            cuenta.vapi_sincronizado_en
              ? `Assistant sincronizado (${new Date(cuenta.vapi_sincronizado_en).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })})`
              : "Assistant sincronizado con Vapi"
          }
        />
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sincronizar}
          disabled={sincronizando || !tieneApiKey || !tieneVoz}
          className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {sincronizando
            ? "Sincronizando..."
            : tieneAssistant
            ? "Resincronizar assistant"
            : "Crear assistant en Vapi"}
        </button>
        {cuenta.vapi_assistant_id && (
          <a
            href={`https://dashboard.vapi.ai/assistants/${cuenta.vapi_assistant_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
          >
            Ver en Vapi ↗
          </a>
        )}
        {todoListo && (
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            ✓ Todo listo para llamar
          </span>
        )}
      </div>
      {resultadoSync && (
        <p
          className={`text-[11px] ${
            resultadoSync.startsWith("✓")
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {resultadoSync}
        </p>
      )}
    </div>
  );
}
