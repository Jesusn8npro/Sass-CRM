"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { etiquetaTipoConsumo } from "@/lib/creditos/precios";

interface FilaUso {
  id: string;
  tipo: string;
  costo_creditos: number;
  costo_usd: number | null;
  metadata: Record<string, unknown>;
  creado_en: string;
}

interface Saldo {
  saldo_actual: number;
  saldo_mensual: number;
  proximo_reset: string | null;
}

interface RespuestaApi {
  saldo: Saldo;
  uso: FilaUso[];
}

export default function PaginaCreditos() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [uso, setUso] = useState<FilaUso[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!idCuenta) return;
    let cancelado = false;
    async function cargar() {
      try {
        const r = await fetch(`/api/cuentas/${idCuenta}/creditos`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as RespuestaApi;
        if (cancelado) return;
        setSaldo(d.saldo);
        setUso(d.uso);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [idCuenta]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          Cuenta
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Créditos y uso
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Cada acción de IA (generar imagen, buscar leads) consume créditos.
          1 crédito ≈ $0.10 USD de valor.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Saldo disponible
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-5xl font-bold">
            {saldo?.saldo_actual ?? (cargando ? "··" : 0)}
          </span>
          <span className="text-sm text-zinc-500">créditos</span>
        </div>
        {saldo?.proximo_reset && (
          <p className="mt-2 text-xs text-zinc-500">
            Próximo reset:{" "}
            {new Date(saldo.proximo_reset).toLocaleDateString("es")}
            {" — "}
            {saldo.saldo_mensual} créditos/mes
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">
          Historial de uso ({uso.length})
        </h2>
        {cargando ? (
          <p className="text-xs text-zinc-500">Cargando…</p>
        ) : uso.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Todavía no consumiste créditos. ¡Probá generar una imagen o buscar leads!
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {uso.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {etiquetaTipoConsumo(u.tipo)}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {new Date(u.creado_en).toLocaleString("es")}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-rose-600 dark:text-rose-400">
                  −{u.costo_creditos}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
