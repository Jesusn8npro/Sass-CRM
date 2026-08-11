"use client";

import { useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";
import {
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  patchCuenta,
} from "./compartido";
import { SeccionVoz } from "./SeccionVoz";
import { SeccionOperadorPrivado } from "./SeccionOperadorPrivado";
import { SeccionDisparadores } from "./SeccionDisparadores";
import { SeccionConfiguracionIA, SeccionComportamiento } from "./_TabIA-ia";
import { SeccionRitmoYMemoria, SeccionPromptAvanzado } from "./_TabIA-ritmo";

export function SeccionPersonalidadAgente({ cuenta, onActualizada }: PropsSeccionBase) {
  const [humanizado, setHumanizado] = useState(cuenta.responder_humanizado !== false);
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
    const r = await patchCuenta(cuenta.id, { responder_humanizado: humanizado, usar_emojis: emojis });
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 2500); }
    setGuardando(false);
  }

  return (
    <Tarjeta titulo="Personalidad del agente" descripcion="Toggles rápidos para el estilo de respuesta. Se aplican automáticamente sin tener que escribir nada en el prompt.">
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={humanizado} onChange={(e) => setHumanizado(e.target.checked)} className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700" />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Responder lo más humano posible <span className="font-normal text-zinc-500">(recomendado)</span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
              Frases naturales y conversacionales — evita formalidades robóticas tipo &quot;Claro, puedo ayudarte con eso&quot; o listas largas con viñetas. Mensajes cortos como hablás vos en WhatsApp.
            </span>
          </span>
        </label>

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={emojis} onChange={(e) => setEmojis(e.target.checked)} className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Permitir uso de emojis</span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                Si está OFF (default), el agente NUNCA usa emojis — tono profesional. Si está ON, los usa con moderación cuando suman (📅 fecha, ✅ confirmación, etc.).
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

export function SeccionAvanzado({ cuenta }: { cuenta: Cuenta }) {
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);

  async function archivar() {
    if (archivando) return;
    setArchivando(true);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}`, { method: "DELETE" });
      if (res.ok) window.location.href = "/";
    } finally {
      setArchivando(false);
      setConfirmando(false);
    }
  }

  return (
    <Tarjeta titulo="Zona peligrosa" descripcion="Archivar la cuenta la oculta del panel y detiene su socket de WhatsApp. Las conversaciones quedan guardadas en la DB pero ya no se muestran.">
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">¿Archivar &quot;{cuenta.etiqueta}&quot;?</p>
          <button type="button" onClick={() => setConfirmando(false)} className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">Cancelar</button>
          <button type="button" onClick={archivar} disabled={archivando} className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-red-400 disabled:opacity-50">{archivando ? "Archivando..." : "Sí, archivar"}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 dark:text-red-300">Archivar cuenta</button>
      )}
    </Tarjeta>
  );
}

export function TabIA({ cuenta, setCuenta }: { cuenta: Cuenta; setCuenta: (c: Cuenta) => void }) {
  return (
    <>
      <SeccionConfiguracionIA cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionPersonalidadAgente cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionComportamiento cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionRitmoYMemoria cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionVoz cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionOperadorPrivado cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionDisparadores cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionPromptAvanzado cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionAvanzado cuenta={cuenta} />
    </>
  );
}
