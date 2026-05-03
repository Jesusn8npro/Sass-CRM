"use client";

import { useState } from "react";
import type { Cita, EstadoCita } from "@/lib/baseDatos";
import { NOMBRE_ESTADO } from "./compartido";

export function ModalCita({
  idCuenta,
  citaActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  citaActual: Cita | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const fechaInicial = citaActual
    ? new Date(citaActual.fecha_hora)
    : new Date(Date.now() + 24 * 3600 * 1000);

  const [nombre, setNombre] = useState(citaActual?.cliente_nombre ?? "");
  const [telefono, setTelefono] = useState(citaActual?.cliente_telefono ?? "");
  const [fecha, setFecha] = useState(fechaInicial.toISOString().slice(0, 10));
  const [hora, setHora] = useState(
    `${String(fechaInicial.getHours()).padStart(2, "0")}:${String(fechaInicial.getMinutes()).padStart(2, "0")}`,
  );
  const [duracion, setDuracion] = useState(citaActual?.duracion_min ?? 30);
  const [tipo, setTipo] = useState(citaActual?.tipo ?? "");
  const [notas, setNotas] = useState(citaActual?.notas ?? "");
  const [estado, setEstado] = useState<EstadoCita>(citaActual?.estado ?? "agendada");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const ms = new Date(`${fecha}T${hora}:00`).getTime();
      const cuerpo = {
        cliente_nombre: nombre.trim(),
        cliente_telefono: telefono.trim() || null,
        fecha_iso: new Date(ms).toISOString(),
        duracion_min: Number(duracion) || 30,
        tipo: tipo.trim() || null,
        notas: notas.trim() || null,
        estado,
      };
      const url = citaActual
        ? `/api/cuentas/${idCuenta}/citas/${citaActual.id}`
        : `/api/cuentas/${idCuenta}/citas`;
      const metodo = citaActual ? "PATCH" : "POST";
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            {citaActual ? "Editar Cita" : "Nueva Cita"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-3 px-5 py-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Título / Motivo *
            </label>
            <input
              type="text"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="ej. Show vallenato — Boda"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Fecha *
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Hora *
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Duración (minutos)
              </label>
              <select
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoCita)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {Object.entries(NOMBRE_ESTADO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Datos del cliente
            </p>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              required
              className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+57 300 1234567"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Notas adicionales
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Detalles relevantes para el operador (ciudad, invitados, requerimientos...)"
              className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar Cita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
