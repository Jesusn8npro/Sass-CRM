"use client";

import { useEffect, useState } from "react";
import {
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  textareaClases,
  patchCuenta,
} from "./compartido";

export function SeccionRitmoYMemoria({ cuenta, onActualizada }: PropsSeccionBase) {
  const [delaySegundos, setDelaySegundos] = useState(cuenta.delay_entre_partes_segundos ?? 3);
  const [mensajesContexto, setMensajesContexto] = useState(cuenta.mensajes_contexto ?? 20);
  const [memoriaLarga, setMemoriaLarga] = useState(cuenta.memoria_largo_plazo ?? true);
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
    const r = await patchCuenta(cuenta.id, { delay_entre_partes_segundos: delaySegundos, mensajes_contexto: mensajesContexto, memoria_largo_plazo: memoriaLarga });
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 2500); }
    setGuardando(false);
  }

  return (
    <Tarjeta titulo="Ritmo y memoria del agente" descripcion="Cuántos segundos espera entre cada mensaje (con 'escribiendo...' visible) y cuánto contexto de la conversación recuerda.">
      <form onSubmit={guardar} className="flex flex-col gap-5">
        <div>
          <Etiqueta>Delay entre mensajes (segundos)</Etiqueta>
          <input type="number" min={0} max={30} step={0.5} value={delaySegundos} onChange={(e) => setDelaySegundos(Math.max(0, Math.min(30, Number(e.target.value) || 0)))} className={`${inputClases()} max-w-[140px]`} />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cuando el agente responde con varios mensajes, espera este tiempo entre cada uno mostrando{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">"escribiendo…"</strong> al cliente.{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">3s</strong> es el ritmo más natural y humano (default).{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">0</strong> = envía todo de una.
          </p>
        </div>

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <Etiqueta>Mensajes de contexto (ventana literal)</Etiqueta>
          <input type="number" min={5} max={200} step={1} value={mensajesContexto} onChange={(e) => setMensajesContexto(Math.max(5, Math.min(200, Math.floor(Number(e.target.value) || 0))))} className={`${inputClases()} max-w-[140px]`} />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cuántos mensajes recientes se mandan{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">literalmente</strong>{" "}
            al modelo en cada respuesta. Más alto = más contexto pero más tokens (más caro y lento).{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">20</strong> es el default y suele ser suficiente.
          </p>
        </div>

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={memoriaLarga} onChange={(e) => setMemoriaLarga(e.target.checked)} className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Memoria a largo plazo (resumen automático)</span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                Mantiene en memoria <strong className="text-zinc-700 dark:text-zinc-300">toda la conversación</strong> de cada cliente, pero condensa los mensajes más viejos en un resumen breve generado con un modelo barato (gpt-4o-mini). Resultado: el agente recuerda nombre, productos discutidos, acuerdos previos y próximos pasos sin importar cuántos mensajes pasaron — manteniendo el costo controlado.<br />
                <strong className="mt-1 inline-block text-zinc-700 dark:text-zinc-300">Recomendado dejarlo activo.</strong>{" "}
                Si lo desactivás, el agente sólo verá los últimos N mensajes de la ventana y olvidará todo lo anterior.
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
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 2500); }
    setGuardando(false);
  }

  return (
    <Tarjeta titulo="Prompt del agente (comportamiento)" descripcion="REGLAS de cómo se comporta el agente: personalidad, tono, qué hacer y qué no. Distinto de 'Información del negocio' (Tab General) — ahí van los DATOS (horarios, precios, productos), acá van las REGLAS DE CONDUCTA.">
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ✅ <strong>Va acá:</strong> &quot;Sé amable y profesional&quot;, &quot;Nunca des descuentos sin que el cliente lo pida&quot;, &quot;Siempre cierra ofreciendo agendar visita&quot;, &quot;Si preguntan por temas legales, derivá a humano&quot;.<br />
          ❌ <strong>NO va acá:</strong> horarios, productos, precios, garantías — eso son DATOS, van en &quot;Información del negocio&quot; (Tab General).
        </p>
        <textarea value={valor} onChange={(e) => setValor(e.target.value)} rows={14} placeholder="Sos un asesor de ventas profesional pero cercano..." className={textareaClases()} />
        <p className="text-xs text-zinc-500">Cambios aplican al próximo mensaje entrante. No hace falta reiniciar el bot.</p>
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
        <span className="text-base font-semibold tracking-tight">⚙ Prompt sistema avanzado (override completo)</span>
        <p className="mt-0.5 text-xs text-zinc-500">Solo si querés escribir un prompt custom de cero. Si lo dejás vacío, el sistema arma uno automático con los datos del Tab General (nombre, rol, personalidad, tono) + tus instrucciones extra.</p>
      </summary>
      <div className="mt-4">
        <SeccionPrompt cuenta={cuenta} onActualizada={onActualizada} />
      </div>
    </details>
  );
}
