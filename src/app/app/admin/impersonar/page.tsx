"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";

interface CuentaFila {
  id: string;
  etiqueta: string;
  estado: string;
  telefono: string | null;
  owner_email: string | null;
  usuario_id: string;
  creado_en: string;
}

export default function PaginaAdminImpersonar() {
  const { exito, error: toastError } = useToast();
  const { confirmar } = useConfirm();

  const [cuentas, setCuentas] = useState<CuentaFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/impersonar", { cache: "no-store" });
      if (!res.ok) {
        toastError("No se pudo cargar el listado");
        return;
      }
      const j = (await res.json()) as { cuentas: CuentaFila[] };
      setCuentas(j.cuentas);
    } finally {
      setCargando(false);
    }
  }, [toastError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function toggleUna(id: string) {
    setSeleccionadas((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  function toggleTodas() {
    if (seleccionadas.size === cuentas.length) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(cuentas.map((c) => c.id)));
    }
  }

  async function borrarUna(c: CuentaFila) {
    const ok = await confirmar({
      titulo: `Eliminar cuenta "${c.etiqueta}"`,
      mensaje:
        "Se borra la cuenta + sesión Baileys + todas sus conversaciones, mensajes, productos, etiquetas, etapas, citas, llamadas y demás datos en cascada. Operación irreversible.",
      variante: "peligro",
      textoConfirmar: "Eliminar definitivamente",
    });
    if (!ok) return;

    const res = await fetch(`/api/admin/cuentas/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      exito(`Cuenta "${c.etiqueta}" eliminada`);
      await cargar();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toastError(j.error ?? "No se pudo eliminar");
    }
  }

  async function borrarSeleccionadas() {
    const ids = Array.from(seleccionadas);
    if (ids.length === 0) return;
    const ok = await confirmar({
      titulo: `Eliminar ${ids.length} cuenta${ids.length === 1 ? "" : "s"}`,
      mensaje:
        "Se borran las cuentas seleccionadas + sus sesiones Baileys + TODAS sus conversaciones, mensajes y datos. Operación irreversible.",
      variante: "peligro",
      textoConfirmar: `Eliminar ${ids.length}`,
    });
    if (!ok) return;

    setBorrando(true);
    try {
      const res = await fetch("/api/admin/cuentas/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        toastError("Falló el borrado por lotes");
        return;
      }
      const j = (await res.json()) as {
        borradas: number;
        intentadas: number;
        errores: { id: string; error: string }[];
      };
      const errExtra = j.errores.length > 0 ? ` (${j.errores.length} con error)` : "";
      exito(`Borradas ${j.borradas}/${j.intentadas}${errExtra}`);
      setSeleccionadas(new Set());
      await cargar();
    } finally {
      setBorrando(false);
    }
  }

  const todasSeleccionadas =
    cuentas.length > 0 && seleccionadas.size === cuentas.length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // cuentas del sistema
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Ver cuentas
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-white/55">
          {cuentas.length} cuentas registradas. Eliminar una cuenta borra todo
          su tenant en cascada (conversaciones, mensajes, productos, sesión
          Baileys, etc) — irreversible.
        </p>
      </header>

      {seleccionadas.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 dark:border-red-400/30 dark:bg-red-400/[0.06]">
          <span className="font-mono text-xs text-red-700 dark:text-red-200">
            {seleccionadas.size} seleccionada{seleccionadas.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => setSeleccionadas(new Set())}
            className="rounded-full border border-red-300 bg-white px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-400/[0.12]"
          >
            Limpiar
          </button>
          <div className="flex-1" />
          <button
            type="button"
            disabled={borrando}
            onClick={() => void borrarSeleccionadas()}
            className="rounded-full bg-red-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {borrando ? "Eliminando…" : `Eliminar ${seleccionadas.size}`}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={toggleTodas}
                    aria-label="Seleccionar todas"
                    className="h-4 w-4 cursor-pointer accent-red-600"
                  />
                </th>
                <th className="px-4 py-3">Etiqueta</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
                    cargando…
                  </td>
                </tr>
              ) : cuentas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
                    sin cuentas
                  </td>
                </tr>
              ) : (
                cuentas.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03] ${
                      seleccionadas.has(c.id) ? "bg-red-50/60 dark:bg-red-400/[0.04]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={seleccionadas.has(c.id)}
                        onChange={() => toggleUna(c.id)}
                        aria-label={`Seleccionar ${c.etiqueta}`}
                        className="h-4 w-4 cursor-pointer accent-red-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-white">{c.etiqueta}</td>
                    <td className="px-4 py-3">
                      <span className={pillEstado(c.estado)}>{c.estado}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-white/60">
                      {c.telefono ? `+${c.telefono}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/60">
                      {c.owner_email ?? c.usuario_id.slice(0, 8) + "…"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/app/admin/impersonar/${c.id}`}
                          className="rounded-full border border-zinc-200 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-white/[0.10] dark:text-emerald-300 dark:hover:border-emerald-400/40"
                        >
                          ver dashboard →
                        </Link>
                        <button
                          type="button"
                          onClick={() => void borrarUna(c)}
                          className="rounded-full border border-red-500/40 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/[0.06] dark:text-red-200 dark:hover:bg-red-400/[0.12]"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function pillEstado(estado: string): string {
  const base = "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider";
  if (estado === "conectado")
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  if (estado === "qr")
    return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/50`;
}
