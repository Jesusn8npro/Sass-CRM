"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { etiquetaTipoConsumo } from "@/lib/creditos/precios";
import { PayPalCheckout, PayPalProvider } from "@/components/PayPalCheckout";

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

interface Paquete {
  id: string;
  nombre: string;
  creditos: number;
  precio_usd: number;
  destacado: boolean;
}

interface RespuestaApi {
  saldo: Saldo;
  uso: FilaUso[];
}

export default function PaginaCreditos() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [uso, setUso] = useState<FilaUso[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [paqueteElegido, setPaqueteElegido] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarTodo() {
    if (!idCuenta) return;
    const [creditos, paqs] = await Promise.all([
      fetch(`/api/cuentas/${idCuenta}/creditos`, { cache: "no-store" }).then((r) => r.json() as Promise<RespuestaApi>),
      fetch(`/api/billing/paquetes`, { cache: "no-store" }).then((r) => r.json() as Promise<{ paquetes: Paquete[] }>),
    ]);
    setSaldo(creditos.saldo);
    setUso(creditos.uso);
    setPaquetes(paqs.paquetes);
    setCargando(false);
  }

  useEffect(() => {
    void cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {mensaje && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            mensaje.tipo === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Recargar créditos</h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">pago vía PayPal</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paquetes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaqueteElegido(p.id)}
              className={`relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all ${
                paqueteElegido === p.id
                  ? "border-emerald-500/60 bg-emerald-500/[0.06] shadow-[0_0_30px_-10px_rgba(52,211,153,0.5)]"
                  : "border-zinc-200 bg-white hover:border-emerald-500/40 dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              {p.destacado && (
                <span className="absolute -top-2 right-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  popular
                </span>
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {p.nombre}
              </span>
              <span className="text-2xl font-bold tracking-tight">
                {p.creditos}
                <span className="ml-1 text-xs font-normal text-zinc-500">créditos</span>
              </span>
              <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                ${p.precio_usd.toFixed(2)} USD
              </span>
            </button>
          ))}
        </div>
        {paqueteElegido && (
          <div className="mt-4 max-w-md">
            <PayPalProvider modo="recarga">
              <PayPalCheckout
                modo="recarga"
                identificador={paqueteElegido}
                cuentaId={idCuenta}
                onExito={(r) => {
                  setMensaje({ tipo: "ok", texto: r.mensaje });
                  setPaqueteElegido(null);
                  void cargarTodo();
                }}
                onError={(m) => setMensaje({ tipo: "error", texto: m })}
              />
            </PayPalProvider>
          </div>
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
