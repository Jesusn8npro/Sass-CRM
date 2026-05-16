"use client";

import { useEffect, useState } from "react";
import {
  Campo,
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
} from "./compartido";

const MODELOS_OPENAI = [
  { id: "gpt-4o-2024-08-06", label: "GPT-4o (recomendado, 100% reliable)", precio: "$$" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini (rápido y económico)", precio: "$" },
  { id: "gpt-4o", label: "GPT-4o (latest)", precio: "$$" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", precio: "$$$" },
];

export function SeccionConfiguracionIA({ cuenta, onActualizada }: PropsSeccionBase) {
  const [modelo, setModelo] = useState(cuenta.modelo ?? "gpt-4o-2024-08-06");
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
    const modeloFinal = modelo === "__custom__" && modeloCustom.trim() ? modeloCustom.trim() : modelo;
    const r = await patchCuenta(cuenta.id, { modelo: modeloFinal, temperatura, max_tokens: maxTokens, instrucciones_extra: extra });
    setGuardando(false);
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 1500); }
  }

  return (
    <Tarjeta titulo="Configuración OpenAI" descripcion="Modelo de IA y parámetros técnicos.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo label="Modelo" hint="Recomendamos GPT-4o (full) para captura de datos confiable. Mini tiene fallas con muchos tools.">
          <select
            value={esCustom ? "__custom__" : modelo}
            onChange={(e) => {
              if (e.target.value === "__custom__") { setModeloCustom(modelo); setModelo("__custom__"); }
              else setModelo(e.target.value);
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {MODELOS_OPENAI.map((m) => <option key={m.id} value={m.id}>{m.label} {m.precio}</option>)}
            <option value="__custom__">— Custom (escribir manualmente) —</option>
          </select>
          {modelo === "__custom__" && (
            <input type="text" value={modeloCustom} onChange={(e) => setModeloCustom(e.target.value)} placeholder="ej. gpt-4o-mini-2024-07-18" className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900" />
          )}
        </Campo>
        <Campo label="Max Tokens (longitud máxima respuesta)" hint="Mínimo 500 con 12 tools strict. 2000 es buen default.">
          <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} min={500} max={8000} step={100} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900" />
        </Campo>
      </div>

      <div className="mt-4">
        <Campo label={`Temperatura (creatividad): ${temperatura.toFixed(2)}`} hint="0.3 = info exacta, 0.7 = ventas (default), 1.0 = casual">
          <input type="range" min={0} max={1.5} step={0.05} value={temperatura} onChange={(e) => setTemperatura(Number(e.target.value))} className="w-full accent-emerald-600" />
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>0 · exacto</span><span>0.7 · ventas</span><span>1.5 · creativo</span>
          </div>
        </Campo>
      </div>

      <div className="mt-4">
        <Campo label="Instrucciones Personalizadas" hint="Notas extra que se agregan al prompt sistema. Ej: 'No mencionar precios sin que pregunten' o 'Siempre ofrecer demo después de 3 mensajes'.">
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={5} placeholder="Reglas extra del negocio que la IA debe respetar..." className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900" />
        </Campo>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <MensajeEstado exito={exito} error={error} />
        <button type="button" onClick={guardar} disabled={guardando} className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
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
    const r = await patchCuenta(cuenta.id, { buffer_segundos: bufferSegundos });
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 2500); }
    setGuardando(false);
  }

  return (
    <Tarjeta titulo="Comportamiento" descripcion="Cómo agrupa el bot los mensajes antes de responder.">
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <Etiqueta>Buffer de mensajes (segundos)</Etiqueta>
          <input type="number" min={0} max={120} value={bufferSegundos} onChange={(e) => setBufferSegundos(Math.max(0, Number(e.target.value) || 0))} className={`${inputClases()} max-w-[140px]`} />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            <strong className="text-zinc-700 dark:text-zinc-300">0</strong> = responder de inmediato a cada mensaje (default).<br />
            <strong className="text-zinc-700 dark:text-zinc-300">5-15s</strong> = esperar ese tiempo después del último mensaje del usuario antes de responder. Si llegan más mensajes en ese lapso, el contador se reinicia. Hace que el bot responda al "bloque completo" en vez de fragmentado, mucho más natural.
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
