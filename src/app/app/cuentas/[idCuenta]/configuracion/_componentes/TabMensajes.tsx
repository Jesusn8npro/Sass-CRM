"use client";

import { useEffect, useState } from "react";
import type {
  Cuenta,
  MedioBiblioteca,
  RespuestaRapida,
} from "@/lib/baseDatos";
import {
  Campo,
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  inputClases,
  patchCuenta,
  textareaClases,
} from "./compartido";
import { SeccionBiblioteca } from "./Biblioteca";
import { SeccionAutoSeguimientos } from "./SeccionAutoSeguimientos";

export function SeccionMensajesPredefinidos({
  cuenta,
  onActualizada,
}: PropsSeccionBase) {
  const [bienvenida, setBienvenida] = useState(cuenta.mensaje_bienvenida);
  const [noEntiende, setNoEntiende] = useState(cuenta.mensaje_no_entiende);
  const [handoff, setHandoff] = useState(cuenta.palabras_handoff);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setBienvenida(cuenta.mensaje_bienvenida);
    setNoEntiende(cuenta.mensaje_no_entiende);
    setHandoff(cuenta.palabras_handoff);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      mensaje_bienvenida: bienvenida,
      mensaje_no_entiende: noEntiende,
      palabras_handoff: handoff,
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
      titulo="Mensajes Predefinidos"
      descripcion="Mensajes específicos para situaciones comunes."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo
          label="Mensaje de Bienvenida"
          hint="Si está vacío, la IA improvisa según el contexto. Si lo llenás, se usa textual cuando un cliente nuevo escribe por primera vez."
        >
          <textarea
            value={bienvenida}
            onChange={(e) => setBienvenida(e.target.value)}
            rows={4}
            placeholder='Ej: "¡Hola! 👋 Soy Eryum del equipo. ¿En qué te puedo ayudar?"'
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Campo>
        <Campo
          label="Mensaje cuando no entiende"
          hint="Cuando el cliente dice algo que la IA no logra interpretar."
        >
          <textarea
            value={noEntiende}
            onChange={(e) => setNoEntiende(e.target.value)}
            rows={4}
            placeholder='Ej: "Disculpá, no entendí bien. ¿Podés reformularlo?"'
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Campo>
      </div>
      <div className="mt-5">
        <Campo
          label="Palabras Clave de Transferencia (a humano)"
          hint="Cuando el cliente escribe alguna de estas frases, el bot pasa a HUMANO automáticamente sin disparar la IA. Separá con comas."
        >
          <input
            type="text"
            value={handoff}
            onChange={(e) => setHandoff(e.target.value)}
            placeholder="hablar con humano, agente humano, queja urgente, asesor"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
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


export function SeccionRespuestasRapidas({
  idCuenta,
  respuestas,
  onCambio,
}: {
  idCuenta: string;
  respuestas: RespuestaRapida[];
  onCambio: () => void;
}) {
  const [creando, setCreando] = useState(false);
  const [atajo, setAtajo] = useState("");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!atajo.trim() || !texto.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/respuestas-rapidas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atajo: atajo.trim(), texto }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Error creando respuesta");
        return;
      }
      setAtajo("");
      setTexto("");
      onCambio();
    } finally {
      setCreando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Respuestas rápidas"
      descripcion="Plantillas de texto pre-guardadas que podés insertar con un click desde el chat. Ej: saludo, despedida, métodos de pago."
    >
      {respuestas.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {respuestas.map((r) => (
            <RespuestaRapidaItem
              key={r.id}
              idCuenta={idCuenta}
              respuesta={r}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}
      <form
        onSubmit={agregar}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Nueva respuesta
        </p>
        <div className="mb-3">
          <Etiqueta>Atajo (corto, identificador)</Etiqueta>
          <input
            type="text"
            value={atajo}
            onChange={(e) => setAtajo(e.target.value)}
            placeholder="saludo / pago / despedida..."
            maxLength={30}
            className={inputClases()}
          />
        </div>
        <div className="mb-3">
          <Etiqueta>Texto de la respuesta</Etiqueta>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="¡Hola! Gracias por escribirnos..."
            className={textareaClases()}
          />
        </div>
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creando || !atajo.trim() || !texto.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creando ? "Agregando..." : "+ Agregar"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function RespuestaRapidaItem({
  idCuenta,
  respuesta,
  onCambio,
}: {
  idCuenta: string;
  respuesta: RespuestaRapida;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [atajo, setAtajo] = useState(respuesta.atajo);
  const [texto, setTexto] = useState(respuesta.texto);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    setAtajo(respuesta.atajo);
    setTexto(respuesta.texto);
  }, [respuesta.id, respuesta.actualizada_en]);

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/respuestas-rapidas/${respuesta.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atajo: atajo.trim(), texto }),
        },
      );
      if (res.ok) {
        setEditando(false);
        onCambio();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/respuestas-rapidas/${respuesta.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onCambio();
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  }

  if (editando) {
    return (
      <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <input
          type="text"
          value={atajo}
          onChange={(e) => setAtajo(e.target.value)}
          maxLength={30}
          className={`${inputClases()} mb-2`}
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          className={`${textareaClases()} mb-2`}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setAtajo(respuesta.atajo);
              setTexto(respuesta.texto);
            }}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !atajo.trim() || !texto.trim()}
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {guardando ? "..." : "Guardar"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {respuesta.atajo}
      </span>
      <p className="flex-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {respuesta.texto}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Editar
        </button>
        {confirmandoBorrado ? (
          <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
              className="rounded-full px-2 py-0.5 text-[10px] text-zinc-600"
            >
              No
            </button>
            <button
              type="button"
              onClick={borrar}
              disabled={borrando}
              className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300"
            >
              {borrando ? "..." : "Sí"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
          >
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}

export function TabMensajes({
  cuenta,
  setCuenta,
  respuestas,
  biblioteca,
  recargarRespuestas,
  recargarBiblioteca,
}: {
  cuenta: Cuenta;
  setCuenta: (c: Cuenta) => void;
  respuestas: RespuestaRapida[];
  biblioteca: MedioBiblioteca[];
  recargarRespuestas: () => Promise<void>;
  recargarBiblioteca: () => Promise<void>;
}) {
  return (
    <>
      <SeccionMensajesPredefinidos cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionAutoSeguimientos idCuenta={cuenta.id} />
      <SeccionRespuestasRapidas
        idCuenta={cuenta.id}
        respuestas={respuestas}
        onCambio={recargarRespuestas}
      />
      <SeccionBiblioteca
        idCuenta={cuenta.id}
        medios={biblioteca}
        onCambio={recargarBiblioteca}
      />
    </>
  );
}
