"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { PLANES } from "@/lib/paypal/planes";

interface FilaUsuario {
  id: string;
  email: string;
  nombre: string | null;
  plan: string;
  estado_billing?: "activo" | "suspendido" | "impago" | "prueba";
  total_cuentas: number;
  creado_en: string;
  vence_en?: string | null;
}

interface RespuestaListado {
  usuarios: FilaUsuario[];
  total: number;
  pagina: number;
  paginas: number;
  limite: number;
}

const TODOS_PLANES = ["", "free", "pro", "business"] as const;
const TODOS_ESTADOS = [
  "",
  "activo",
  "suspendido",
  "impago",
  "prueba",
] as const;

export default function PaginaAdminUsuarios() {
  const { exito, error: toastError } = useToast();
  const { confirmar } = useConfirm();

  const [datos, setDatos] = useState<RespuestaListado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaInput, setBusquedaInput] = useState("");
  const [plan, setPlan] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("q", busqueda);
      if (plan) params.set("plan", plan);
      if (estado) params.set("estado", estado);
      params.set("pagina", String(pagina));
      const res = await fetch(`/api/admin/usuarios?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toastError("No se pudo cargar el listado");
        return;
      }
      setDatos((await res.json()) as RespuestaListado);
    } finally {
      setCargando(false);
    }
  }, [busqueda, plan, estado, pagina, toastError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutarAccion(
    usuarioId: string,
    accion: "suspender" | "reactivar",
  ) {
    const ok = await confirmar({
      titulo: accion === "suspender" ? "Suspender usuario" : "Reactivar usuario",
      mensaje:
        accion === "suspender"
          ? "El usuario va a quedar marcado como suspendido. Sus cuentas siguen físicamente, pero el flag estado_billing cambia."
          : "Volverá a estado activo. Hacé esto si confirmaste el pago manualmente.",
      variante: accion === "suspender" ? "peligro" : "neutro",
      textoConfirmar: accion === "suspender" ? "Suspender" : "Reactivar",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion }),
    });
    if (res.ok) {
      exito(accion === "suspender" ? "Usuario suspendido" : "Usuario reactivado");
      await cargar();
    } else {
      toastError("Acción falló");
    }
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setPagina(1);
    setBusqueda(busquedaInput.trim());
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // usuarios
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Listado de tenants
        </h1>
      </header>

      <form
        onSubmit={buscar}
        className="mb-6 flex flex-col gap-3 md:flex-row md:items-center"
      >
        <input
          type="search"
          value={busquedaInput}
          onChange={(e) => setBusquedaInput(e.target.value)}
          placeholder="Buscar por email…"
          className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white dark:placeholder:text-white/30 dark:focus:border-emerald-400/50"
        />
        <select
          value={plan}
          onChange={(e) => {
            setPagina(1);
            setPlan(e.target.value);
          }}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 font-mono text-xs uppercase tracking-wider text-zinc-900 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white"
        >
          {TODOS_PLANES.map((p) => (
            <option key={p || "todos"} value={p} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white">
              {p ? p : "todos los planes"}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => {
            setPagina(1);
            setEstado(e.target.value);
          }}
          className="rounded-full border border-zinc-200 bg-white px-4 py-2 font-mono text-xs uppercase tracking-wider text-zinc-900 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-white"
        >
          {TODOS_ESTADOS.map((es) => (
            <option key={es || "todos"} value={es} className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white">
              {es ? es : "todos los estados"}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-white dark:text-black dark:hover:bg-emerald-300"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Cuentas</th>
              <th className="px-4 py-3 text-right">MRR (USD)</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-white/40">
                  Cargando…
                </td>
              </tr>
            ) : !datos || datos.usuarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500 dark:text-white/40">
                  Sin resultados
                </td>
              </tr>
            ) : (
              datos.usuarios.map((u) => {
                const mrr = mrrUsuario(u.plan);
                return (
                  <tr
                    key={u.id}
                    className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/admin/usuarios/${u.id}`}
                        className="text-zinc-900 hover:text-emerald-600 hover:underline dark:text-white dark:hover:text-emerald-300"
                      >
                        {u.email}
                      </Link>
                      {u.nombre && (
                        <p className="text-[11px] text-zinc-500 dark:text-white/40">{u.nombre}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                      <span className={pillPlan(u.plan)}>{u.plan}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                      <span className={pillEstado(u.estado_billing)}>
                        {u.estado_billing ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-700 dark:text-white/80">
                      {u.total_cuentas}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-white">
                      {mrr ? `$${mrr}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                      {u.vence_en
                        ? new Date(u.vence_en).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {u.estado_billing === "suspendido" ? (
                          <button
                            type="button"
                            onClick={() => void ejecutarAccion(u.id, "reactivar")}
                            className="rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.12]"
                          >
                            Reactivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void ejecutarAccion(u.id, "suspender")}
                            className="rounded-full border border-red-500/40 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/[0.06] dark:text-red-200 dark:hover:bg-red-400/[0.12]"
                          >
                            Suspender
                          </button>
                        )}
                        <Link
                          href={`/app/admin/usuarios/${u.id}`}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:border-zinc-400 dark:border-white/[0.10] dark:text-white/80 dark:hover:border-white/30"
                        >
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {datos && datos.paginas > 1 && (
        <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-zinc-500 dark:text-white/50">
          <span>
            página {datos.pagina} de {datos.paginas} · {datos.total} usuarios
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={datos.pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-700 hover:border-zinc-400 disabled:opacity-40 dark:border-white/[0.10] dark:text-white/80 dark:hover:border-white/30"
            >
              ← anterior
            </button>
            <button
              type="button"
              disabled={datos.pagina >= datos.paginas}
              onClick={() => setPagina((p) => p + 1)}
              className="rounded-full border border-zinc-200 px-3 py-1 text-zinc-700 hover:border-zinc-400 disabled:opacity-40 dark:border-white/[0.10] dark:text-white/80 dark:hover:border-white/30"
            >
              siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function mrrUsuario(plan: string): number {
  if (plan === "pro") return PLANES.pro.precioMensualUsd;
  if (plan === "business") return PLANES.business.precioMensualUsd;
  return 0;
}

function pillPlan(plan: string): string {
  const base =
    "inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wider";
  if (plan === "pro")
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  if (plan === "business")
    return `${base} border-violet-500/40 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/[0.08] dark:text-violet-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/70`;
}

function pillEstado(estado?: string): string {
  const base =
    "inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wider";
  if (estado === "activo")
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  if (estado === "suspendido")
    return `${base} border-red-500/40 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/[0.08] dark:text-red-200`;
  if (estado === "impago")
    return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
  if (estado === "prueba")
    return `${base} border-blue-500/40 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/[0.08] dark:text-blue-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/50`;
}
