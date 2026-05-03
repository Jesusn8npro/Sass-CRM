"use client";

import { useState } from "react";
import type { Cuenta, EtiquetaConCount } from "@/lib/baseDatos";
import { EditorCamposCaptura } from "@/components/EditorCamposCaptura";
import { Tarjeta, inputClases } from "./compartido";

const COLORES_DISPONIBLES = [
  { id: "zinc", clase: "bg-zinc-500" },
  { id: "rojo", clase: "bg-red-500" },
  { id: "ambar", clase: "bg-amber-500" },
  { id: "amarillo", clase: "bg-yellow-500" },
  { id: "esmeralda", clase: "bg-emerald-500" },
  { id: "azul", clase: "bg-blue-500" },
  { id: "violeta", clase: "bg-violet-500" },
  { id: "rosa", clase: "bg-pink-500" },
] as const;

function clasesPillEtiqueta(color: string): string {
  switch (color) {
    case "rojo":
      return "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30";
    case "ambar":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30";
    case "amarillo":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 ring-yellow-500/30";
    case "esmeralda":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30";
    case "azul":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30";
    case "violeta":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30";
    case "rosa":
      return "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 ring-zinc-500/30";
  }
}

export function SeccionEtiquetas({
  idCuenta,
  etiquetas,
  onCambio,
}: {
  idCuenta: string;
  etiquetas: EtiquetaConCount[];
  onCambio: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("esmeralda");
  const [descripcion, setDescripcion] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/etiquetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          color,
          descripcion: descripcion.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error creando etiqueta");
        return;
      }
      setNombre("");
      setDescripcion("");
      onCambio();
    } finally {
      setCreando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Etiquetas (CRM)"
      descripcion="Marcá conversaciones con etiquetas para organizar tu pipeline: caliente, comprado, seguimiento, etc. Después podés filtrar conversaciones por etiqueta en el panel."
    >
      {etiquetas.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {etiquetas.map((e) => (
            <EtiquetaItem
              key={e.id}
              idCuenta={idCuenta}
              etiqueta={e}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={crear}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Nueva etiqueta
        </p>
        <div className="mb-3 flex gap-3">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Caliente, Comprado, Seguimiento..."
            maxLength={30}
            className={`${inputClases()} flex-1`}
          />
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
            {COLORES_DISPONIBLES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                title={c.id}
                className={`h-5 w-5 rounded-full ${c.clase} transition-all ${
                  color === c.id
                    ? "ring-2 ring-zinc-900 ring-offset-1 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-900"
                    : "opacity-70 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción opcional (ayuda al equipo a saber cuándo usarla)"
          maxLength={120}
          className={`${inputClases()} mb-3`}
        />
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creando || !nombre.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creando ? "Creando..." : "+ Crear etiqueta"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function EtiquetaItem({
  idCuenta,
  etiqueta,
  onCambio,
}: {
  idCuenta: string;
  etiqueta: EtiquetaConCount;
  onCambio: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/etiquetas/${etiqueta.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onCambio();
    } finally {
      setBorrando(false);
      setConfirmando(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${clasesPillEtiqueta(
          etiqueta.color,
        )}`}
      >
        {etiqueta.nombre}
      </span>
      <div className="flex-1 min-w-0">
        {etiqueta.descripcion && (
          <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
            {etiqueta.descripcion}
          </p>
        )}
        <p className="text-[10px] text-zinc-500">
          {etiqueta.conversaciones_count}{" "}
          {etiqueta.conversaciones_count === 1
            ? "conversación"
            : "conversaciones"}
        </p>
      </div>
      {confirmando ? (
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
          <button
            type="button"
            onClick={() => setConfirmando(false)}
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
          onClick={() => setConfirmando(true)}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
        >
          Borrar
        </button>
      )}
    </li>
  );
}

export function TabCaptura({
  cuenta,
  setCuenta,
  etiquetas,
  recargarEtiquetas,
}: {
  cuenta: Cuenta;
  setCuenta: React.Dispatch<React.SetStateAction<Cuenta | null>>;
  etiquetas: EtiquetaConCount[];
  recargarEtiquetas: () => Promise<void>;
}) {
  return (
    <>
      <EditorCamposCaptura
        idCuenta={cuenta.id}
        valorInicial={cuenta.campos_a_capturar ?? []}
        onGuardado={(nuevos) =>
          setCuenta((c) => (c ? { ...c, campos_a_capturar: nuevos } : c))
        }
      />
      <SeccionEtiquetas
        idCuenta={cuenta.id}
        etiquetas={etiquetas}
        onCambio={recargarEtiquetas}
      />
    </>
  );
}
