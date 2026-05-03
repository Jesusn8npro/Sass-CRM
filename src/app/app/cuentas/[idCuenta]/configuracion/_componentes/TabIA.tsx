"use client";

import { useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";
import {
  Campo,
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
  textareaClases,
} from "./compartido";
import { SeccionVoz } from "./SeccionVoz";

const MODELOS_OPENAI = [
  { id: "gpt-4o-2024-08-06", label: "GPT-4o (recomendado, 100% reliable)", precio: "$$" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini (rápido y económico)", precio: "$" },
  { id: "gpt-4o", label: "GPT-4o (latest)", precio: "$$" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", precio: "$$$" },
];

export function SeccionConfiguracionIA({ cuenta, onActualizada }: PropsSeccionBase) {
  const [modelo, setModelo] = useState(
    cuenta.modelo ?? "gpt-4o-2024-08-06",
  );
  const [modeloCustom, setModeloCustom] = useState("");
  const [temperatura, setTemperatura] = useState(cuenta.temperatura);
  const [maxTokens, setMaxTokens] = useState(cuenta.max_tokens);
  const [extra, setExtra] = useState(cuenta.instrucciones_extra);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const esCustom = !MODELOS_OPENAI.find((m) => m.id === modelo);

  useEffect(() => {
    setModelo(cuenta.modelo ?? "gpt-4o-2024-08-06");
    setTemperatura(cuenta.temperatura);
    setMaxTokens(cuenta.max_tokens);
    setExtra(cuenta.instrucciones_extra);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    setGuardando(true);
    setError(null);
    setExito(false);
    const modeloFinal =
      modelo === "__custom__" && modeloCustom.trim()
        ? modeloCustom.trim()
        : modelo;
    const r = await patchCuenta(cuenta.id, {
      modelo: modeloFinal,
      temperatura,
      max_tokens: maxTokens,
      instrucciones_extra: extra,
    });
    setGuardando(false);
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 1500);
    }
  }

  return (
    <Tarjeta
      titulo="Configuración OpenAI"
      descripcion="Modelo de IA y parámetros técnicos."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo
          label="Modelo"
          hint="Recomendamos GPT-4o (full) para captura de datos confiable. Mini tiene fallas con muchos tools."
        >
          <select
            value={esCustom ? "__custom__" : modelo}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setModeloCustom(modelo);
                setModelo("__custom__");
              } else {
                setModelo(e.target.value);
              }
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {MODELOS_OPENAI.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} {m.precio}
              </option>
            ))}
            <option value="__custom__">— Custom (escribir manualmente) —</option>
          </select>
          {modelo === "__custom__" && (
            <input
              type="text"
              value={modeloCustom}
              onChange={(e) => setModeloCustom(e.target.value)}
              placeholder="ej. gpt-4o-mini-2024-07-18"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900"
            />
          )}
        </Campo>
        <Campo
          label="Max Tokens (longitud máxima respuesta)"
          hint="Mínimo 500 con 12 tools strict. 2000 es buen default."
        >
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            min={500}
            max={8000}
            step={100}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Campo>
      </div>

      <div className="mt-4">
        <Campo
          label={`Temperatura (creatividad): ${temperatura.toFixed(2)}`}
          hint="0.3 = info exacta, 0.7 = ventas (default), 1.0 = casual"
        >
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={temperatura}
            onChange={(e) => setTemperatura(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>0 · exacto</span>
            <span>0.7 · ventas</span>
            <span>1.5 · creativo</span>
          </div>
        </Campo>
      </div>

      <div className="mt-4">
        <Campo
          label="Instrucciones Personalizadas"
          hint="Notas extra que se agregan al prompt sistema. Ej: 'No mencionar precios sin que pregunten' o 'Siempre ofrecer demo después de 3 mensajes'."
        >
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={5}
            placeholder="Reglas extra del negocio que la IA debe respetar..."
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Campo>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <MensajeEstado exito={exito} error={error} />
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Tarjeta>
  );
}

export function SeccionComportamiento({ cuenta, onActualizada }: PropsSeccionBase) {
  const [bufferSegundos, setBufferSegundos] = useState(cuenta.buffer_segundos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setBufferSegundos(cuenta.buffer_segundos);
    setError(null);
    setExito(false);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      buffer_segundos: bufferSegundos,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Comportamiento"
      descripcion="Cómo agrupa el bot los mensajes antes de responder."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <Etiqueta>Buffer de mensajes (segundos)</Etiqueta>
          <input
            type="number"
            min={0}
            max={120}
            value={bufferSegundos}
            onChange={(e) =>
              setBufferSegundos(Math.max(0, Number(e.target.value) || 0))
            }
            className={`${inputClases()} max-w-[140px]`}
          />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            <strong className="text-zinc-700 dark:text-zinc-300">0</strong> =
            responder de inmediato a cada mensaje (default).
            <br />
            <strong className="text-zinc-700 dark:text-zinc-300">5-15s</strong> ={" "}
            esperar ese tiempo después del último mensaje del usuario antes de
            responder. Si llegan más mensajes en ese lapso, el contador se
            reinicia. Hace que el bot responda al "bloque completo" en vez de
            fragmentado, mucho más natural.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}

export function SeccionPrompt({ cuenta, onActualizada }: PropsSeccionBase) {
  const [valor, setValor] = useState(cuenta.prompt_sistema);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setValor(cuenta.prompt_sistema);
    setError(null);
    setExito(false);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, { prompt_sistema: valor });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Prompt del agente"
      descripcion="Instrucciones base: personalidad, tono, reglas, qué hacer y qué no. Es lo primero que ve el modelo en cada conversación."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <textarea
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={14}
          placeholder="Eres un asistente virtual amable. Responde en español neutro..."
          className={textareaClases()}
        />
        <p className="text-xs text-zinc-500">
          Cambios aplican al próximo mensaje entrante. No hace falta reiniciar
          el bot.
        </p>
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}

export function SeccionPromptAvanzado({ cuenta, onActualizada }: PropsSeccionBase) {
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer">
        <span className="text-base font-semibold tracking-tight">
          ⚙ Prompt sistema avanzado (override completo)
        </span>
        <p className="mt-0.5 text-xs text-zinc-500">
          Solo si querés escribir un prompt custom de cero. Si lo dejás
          vacío, el sistema arma uno automático con los datos del Tab General
          (nombre, rol, personalidad, tono) + tus instrucciones extra.
        </p>
      </summary>
      <div className="mt-4">
        <SeccionPrompt cuenta={cuenta} onActualizada={onActualizada} />
      </div>
    </details>
  );
}

export function SeccionAvanzado({ cuenta }: { cuenta: Cuenta }) {
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);

  async function archivar() {
    if (archivando) return;
    setArchivando(true);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Volver al panel principal
        window.location.href = "/";
      }
    } finally {
      setArchivando(false);
      setConfirmando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Zona peligrosa"
      descripcion="Archivar la cuenta la oculta del panel y detiene su socket de WhatsApp. Las conversaciones quedan guardadas en la DB pero ya no se muestran."
    >
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">
            ¿Archivar "{cuenta.etiqueta}"?
          </p>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={archivar}
            disabled={archivando}
            className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-red-400 disabled:opacity-50"
          >
            {archivando ? "Archivando..." : "Sí, archivar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 dark:text-red-300"
        >
          Archivar cuenta
        </button>
      )}
    </Tarjeta>
  );
}

export function TabIA({
  cuenta,
  setCuenta,
}: {
  cuenta: Cuenta;
  setCuenta: (c: Cuenta) => void;
}) {
  return (
    <>
      <SeccionConfiguracionIA cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionComportamiento cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionVoz cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionPromptAvanzado cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionAvanzado cuenta={cuenta} />
    </>
  );
}
