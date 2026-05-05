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
import { SeccionOperadorPrivado } from "./SeccionOperadorPrivado";

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

export function SeccionRitmoYMemoria({
  cuenta,
  onActualizada,
}: PropsSeccionBase) {
  const [delaySegundos, setDelaySegundos] = useState(
    cuenta.delay_entre_partes_segundos ?? 3,
  );
  const [mensajesContexto, setMensajesContexto] = useState(
    cuenta.mensajes_contexto ?? 20,
  );
  const [memoriaLarga, setMemoriaLarga] = useState(
    cuenta.memoria_largo_plazo ?? true,
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setDelaySegundos(cuenta.delay_entre_partes_segundos ?? 3);
    setMensajesContexto(cuenta.mensajes_contexto ?? 20);
    setMemoriaLarga(cuenta.memoria_largo_plazo ?? true);
    setError(null);
    setExito(false);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      delay_entre_partes_segundos: delaySegundos,
      mensajes_contexto: mensajesContexto,
      memoria_largo_plazo: memoriaLarga,
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
      titulo="Ritmo y memoria del agente"
      descripcion="Cuántos segundos espera entre cada mensaje (con 'escribiendo...' visible) y cuánto contexto de la conversación recuerda."
    >
      <form onSubmit={guardar} className="flex flex-col gap-5">
        <div>
          <Etiqueta>Delay entre mensajes (segundos)</Etiqueta>
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={delaySegundos}
            onChange={(e) =>
              setDelaySegundos(
                Math.max(0, Math.min(30, Number(e.target.value) || 0)),
              )
            }
            className={`${inputClases()} max-w-[140px]`}
          />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cuando el agente responde con varios mensajes, espera este tiempo
            entre cada uno mostrando{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">
              "escribiendo…"
            </strong>{" "}
            al cliente.{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">3s</strong> es
            el ritmo más natural y humano (default).{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">0</strong> =
            envía todo de una.
          </p>
        </div>

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <Etiqueta>Mensajes de contexto (ventana literal)</Etiqueta>
          <input
            type="number"
            min={5}
            max={200}
            step={1}
            value={mensajesContexto}
            onChange={(e) =>
              setMensajesContexto(
                Math.max(5, Math.min(200, Math.floor(Number(e.target.value) || 0))),
              )
            }
            className={`${inputClases()} max-w-[140px]`}
          />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cuántos mensajes recientes se mandan{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">
              literalmente
            </strong>{" "}
            al modelo en cada respuesta. Más alto = más contexto pero más
            tokens (más caro y lento).{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">20</strong> es
            el default y suele ser suficiente.
          </p>
        </div>

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={memoriaLarga}
              onChange={(e) => setMemoriaLarga(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Memoria a largo plazo (resumen automático)
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                Mantiene en memoria{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  toda la conversación
                </strong>{" "}
                de cada cliente, pero condensa los mensajes más viejos en un
                resumen breve generado con un modelo barato (gpt-4o-mini).
                Resultado: el agente recuerda nombre, productos discutidos,
                acuerdos previos y próximos pasos sin importar cuántos
                mensajes pasaron — manteniendo el costo controlado.
                <br />
                <strong className="mt-1 inline-block text-zinc-700 dark:text-zinc-300">
                  Recomendado dejarlo activo.
                </strong>{" "}
                Si lo desactivás, el agente sólo verá los últimos N mensajes
                de la ventana y olvidará todo lo anterior.
              </span>
            </span>
          </label>
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
      titulo="Prompt del agente (comportamiento)"
      descripcion="REGLAS de cómo se comporta el agente: personalidad, tono, qué hacer y qué no. Distinto de 'Información del negocio' (Tab General) — ahí van los DATOS (horarios, precios, productos), acá van las REGLAS DE CONDUCTA."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ✅ <strong>Va acá:</strong> &quot;Sé amable y profesional&quot;, &quot;Nunca des descuentos
          sin que el cliente lo pida&quot;, &quot;Siempre cierra ofreciendo agendar visita&quot;,
          &quot;Si preguntan por temas legales, derivá a humano&quot;.
          <br />
          ❌ <strong>NO va acá:</strong> horarios, productos, precios, garantías —
          eso son DATOS, van en &quot;Información del negocio&quot; (Tab General).
        </p>
        <textarea
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={14}
          placeholder="Sos un asesor de ventas profesional pero cercano. Tu objetivo es entender qué necesita el cliente y guiarlo hacia una visita o llamada. Reglas: nunca prometás algo que no podés cumplir, siempre capturá nombre y teléfono antes de cerrar..."
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

/**
 * Toggles "de fábrica" para personalidad del agente:
 * - responder_humanizado: respuestas naturales vs robóticas (default true)
 * - usar_emojis: permitir emojis en respuestas (default false)
 * Las reglas correspondientes se inyectan en el system prompt
 * automáticamente desde construirPrompt.ts.
 */
export function SeccionPersonalidadAgente({
  cuenta,
  onActualizada,
}: PropsSeccionBase) {
  const [humanizado, setHumanizado] = useState(
    cuenta.responder_humanizado !== false,
  );
  const [emojis, setEmojis] = useState(cuenta.usar_emojis === true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setHumanizado(cuenta.responder_humanizado !== false);
    setEmojis(cuenta.usar_emojis === true);
    setError(null);
    setExito(false);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      responder_humanizado: humanizado,
      usar_emojis: emojis,
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
      titulo="Personalidad del agente"
      descripcion="Toggles rápidos para el estilo de respuesta. Se aplican automáticamente sin tener que escribir nada en el prompt."
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={humanizado}
            onChange={(e) => setHumanizado(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
          />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Responder lo más humano posible{" "}
              <span className="font-normal text-zinc-500">(recomendado)</span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
              Frases naturales y conversacionales — evita formalidades robóticas
              tipo &quot;Claro, puedo ayudarte con eso&quot; o listas largas con
              viñetas. Mensajes cortos como hablás vos en WhatsApp.
            </span>
          </span>
        </label>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={emojis}
              onChange={(e) => setEmojis(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Permitir uso de emojis
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                Si está OFF (default), el agente NUNCA usa emojis — tono
                profesional. Si está ON, los usa con moderación cuando suman
                (📅 fecha, ✅ confirmación, etc.).
              </span>
            </span>
          </label>
        </div>

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
      <SeccionPersonalidadAgente cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionComportamiento cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionRitmoYMemoria cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionVoz cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionOperadorPrivado cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionPromptAvanzado cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionAvanzado cuenta={cuenta} />
    </>
  );
}
