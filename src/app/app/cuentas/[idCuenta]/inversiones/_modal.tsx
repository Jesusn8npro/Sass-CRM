"use client";

import { useState } from "react";
import type { Inversion } from "@/lib/baseDatos";
import { MONEDAS } from "@/lib/constantes";

const CATEGORIAS_SUGERIDAS = [
  "Publicidad",
  "Inventario",
  "Salarios",
  "Software",
  "Servicios",
  "Otros",
];

export function ModalInversion({
  idCuenta,
  inversionActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  inversionActual: Inversion | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [concepto, setConcepto] = useState(inversionActual?.concepto ?? "");
  const [monto, setMonto] = useState<string>(
    inversionActual ? String(inversionActual.monto) : "",
  );
  const [moneda, setMoneda] = useState(inversionActual?.moneda ?? "COP");
  const [categoria, setCategoria] = useState(
    inversionActual?.categoria ?? "Publicidad",
  );
  const [fecha, setFecha] = useState<string>(
    inversionActual
      ? new Date(inversionActual.fecha).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [notas, setNotas] = useState(inversionActual?.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!concepto.trim() || !monto.trim() || Number(monto) <= 0) {
      setError("Concepto y monto positivo son obligatorios.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const url = inversionActual
        ? `/api/cuentas/${idCuenta}/inversiones/${inversionActual.id}`
        : `/api/cuentas/${idCuenta}/inversiones`;
      const metodo = inversionActual ? "PATCH" : "POST";
      const cuerpo = {
        concepto: concepto.trim(),
        monto: Number(monto),
        moneda,
        categoria: categoria.trim() || null,
        fecha,
        notas: notas.trim() || null,
      };
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {inversionActual ? "Editar inversión" : "Registrar gasto"}
        </h2>

        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Concepto
            </label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              required
              maxLength={120}
              placeholder="Ej: Campaña Meta Ads octubre"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Monto
              </label>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                required
                step="0.01"
                min={0}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Moneda
              </label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Categoría
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                list="categorias-inv"
                placeholder="Ej: Publicidad"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <datalist id="categorias-inv">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Detalles, factura, link a la campaña..."
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
