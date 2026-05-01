"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  Cuenta,
  Inversion,
  ResumenInversiones,
} from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaInversiones {
  inversiones: Inversion[];
  resumen: ResumenInversiones;
}

const MONEDAS = ["COP", "USD", "ARS", "MXN", "EUR", "PEN", "CLP"];
const CATEGORIAS_SUGERIDAS = [
  "Publicidad",
  "Inventario",
  "Salarios",
  "Software / SaaS",
  "Servicios",
  "Otros",
];

function formatearFecha(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatearMonto(monto: number, moneda: string): string {
  return `${monto.toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${moneda}`;
}

export default function PaginaInversiones() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = Number(params?.idCuenta);

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [inversiones, setInversiones] = useState<Inversion[]>([]);
  const [resumen, setResumen] = useState<ResumenInversiones | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Inversion | null>(null);

  const cargar = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    const [resCuenta, resInv] = await Promise.all([
      fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
      fetch(`/api/cuentas/${idCuenta}/inversiones`, { cache: "no-store" }),
    ]);
    if (resCuenta.ok) {
      const d = (await resCuenta.json()) as RespuestaCuenta;
      setCuenta(d.cuenta);
    }
    if (resInv.ok) {
      const d = (await resInv.json()) as RespuestaInversiones;
      setInversiones(d.inversiones);
      setResumen(d.resumen);
    }
  }, [idCuenta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function borrar(id: number) {
    if (!confirm("¿Borrar esta inversión?")) return;
    await fetch(`/api/cuentas/${idCuenta}/inversiones/${id}`, {
      method: "DELETE",
    });
    cargar();
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Inversiones
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setModalAbierto(true);
              }}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              + Registrar gasto
            </button>
            <Link
              href={`/cuentas/${idCuenta}/dashboard`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Dashboard
            </Link>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        {/* Totales */}
        {resumen && resumen.por_moneda.length > 0 && (
          <section className="mb-4 grid gap-3 grid-cols-2 md:grid-cols-4">
            {resumen.por_moneda.map((r) => (
              <div
                key={r.moneda}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Total {r.moneda}
                </p>
                <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatearMonto(r.total, r.moneda)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {r.n} movimiento{r.n === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Por categoría */}
        {resumen && resumen.por_categoria.length > 0 && (
          <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Por categoría
            </h2>
            <ul className="flex flex-col gap-1">
              {resumen.por_categoria.map((c, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                    {c.categoria}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatearMonto(c.total, c.moneda)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tabla */}
        {inversiones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aún no hay gastos registrados
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Registrá lo que gastás en publicidad, inventario, salarios y
              servicios para ver el ROI completo de tu negocio.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Concepto</th>
                  <th className="px-3 py-2 font-semibold">Categoría</th>
                  <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {inversiones.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-zinc-50 dark:border-zinc-800/60"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">
                      {formatearFecha(inv.fecha)}
                    </td>
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                      <p className="font-medium">{inv.concepto}</p>
                      {inv.notas && (
                        <p className="text-[11px] text-zinc-500">{inv.notas}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {inv.categoria || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatearMonto(inv.monto, inv.moneda)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(inv);
                          setModalAbierto(true);
                        }}
                        className="text-[11px] text-zinc-500 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => borrar(inv.id)}
                        className="ml-2 text-[11px] text-red-600 hover:underline"
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalInversion
          idCuenta={idCuenta}
          inversionActual={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </main>
  );
}

function ModalInversion({
  idCuenta,
  inversionActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: number;
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
      ? new Date(inversionActual.fecha * 1000).toISOString().slice(0, 10)
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
      const fechaUnix = Math.floor(new Date(fecha + "T12:00:00").getTime() / 1000);
      const cuerpo = {
        concepto: concepto.trim(),
        monto: Number(monto),
        moneda,
        categoria: categoria.trim() || null,
        fecha: fechaUnix,
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
