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

interface UsoProveedor {
  proveedor: string;
  costo_usd: number;
  eventos: number;
}

const LABEL_PROVEEDOR: Record<string, string> = {
  openai: "OpenAI (IA)",
  vapi: "Vapi (Llamadas)",
  elevenlabs: "ElevenLabs (Voz)",
  apify: "Apify (Leads)",
  whisper: "Whisper (Transcripción)",
  anthropic: "Anthropic",
  gemini: "Gemini",
};

const PROVEEDORES_ORDEN = ["vapi", "openai", "elevenlabs", "whisper", "apify", "anthropic", "gemini"];

function fmt(n: number) {
  return n.toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BarraGasto({ gasto, limite }: { gasto: number; limite: number }) {
  if (limite === 0) return null;
  const pct = Math.min((gasto / limite) * 100, 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PaginaCreditos() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [uso, setUso] = useState<FilaUso[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [paqueteElegido, setPaqueteElegido] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(true);

  // Provider usage this month
  const [usoProveedores, setUsoProveedores] = useState<UsoProveedor[]>([]);
  const [limites, setLimites] = useState<Record<string, number>>({});
  const [limitesEdit, setLimitesEdit] = useState<Record<string, string>>({});
  const [guardandoLimites, setGuardandoLimites] = useState(false);
  const [msgLimites, setMsgLimites] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function cargarTodo() {
    if (!idCuenta) return;
    const [creditos, paqs, usoMes] = await Promise.all([
      fetch(`/api/cuentas/${idCuenta}/creditos`, { cache: "no-store" }).then((r) => r.json() as Promise<RespuestaApi>),
      fetch(`/api/billing/paquetes`, { cache: "no-store" }).then((r) => r.json() as Promise<{ paquetes: Paquete[] }>),
      fetch(`/api/cuentas/${idCuenta}/creditos/uso-mes`, { cache: "no-store" }).then((r) =>
        r.json() as Promise<{ uso: UsoProveedor[]; limites_gasto?: Record<string, number> }>
      ),
    ]);
    setSaldo(creditos.saldo);
    setUso(creditos.uso);
    setPaquetes(paqs.paquetes);
    setUsoProveedores(usoMes.uso ?? []);
    const lim = usoMes.limites_gasto ?? {};
    setLimites(lim);
    // Init edit fields from saved limits
    const editInit: Record<string, string> = {};
    for (const p of PROVEEDORES_ORDEN) {
      editInit[p] = lim[p] != null ? String(lim[p]) : "";
    }
    setLimitesEdit(editInit);
    setCargando(false);
  }

  useEffect(() => {
    void cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  async function guardarLimites(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoLimites(true);
    setMsgLimites(null);
    const payload: Record<string, number> = {};
    for (const [k, v] of Object.entries(limitesEdit)) {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0) payload[k] = n;
      else payload[k] = 0;
    }
    const r = await fetch(`/api/cuentas/${idCuenta}/creditos/limites`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limites: payload }),
    });
    const d = await r.json() as { ok?: boolean; error?: string; limites?: Record<string, number> };
    if (r.ok && d.ok) {
      setLimites(d.limites ?? payload);
      setMsgLimites({ tipo: "ok", texto: "Límites guardados" });
    } else {
      setMsgLimites({ tipo: "error", texto: d.error ?? "Error al guardar" });
    }
    setGuardandoLimites(false);
  }

  const totalUsdMes = usoProveedores.reduce((s, u) => s + u.costo_usd, 0);
  const usoMap = Object.fromEntries(usoProveedores.map((u) => [u.proveedor, u]));

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

      {/* ── GASTO POR PLATAFORMA ESTE MES ── */}
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Gasto en plataformas IA — este mes</h2>
          {totalUsdMes > 0 && (
            <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Total: ${fmt(totalUsdMes)}
            </span>
          )}
        </div>

        {cargando ? (
          <p className="text-xs text-zinc-500">Cargando…</p>
        ) : usoProveedores.length === 0 ? (
          <p className="text-xs text-zinc-500">Sin consumo registrado este mes.</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {PROVEEDORES_ORDEN.filter((p) => usoMap[p]).map((p) => {
              const u = usoMap[p]!;
              const lim = limites[p] ?? 0;
              return (
                <div key={p} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {LABEL_PROVEEDOR[p] ?? p}
                    </p>
                    <p className="text-xs text-zinc-400">{u.eventos} eventos</p>
                    {lim > 0 && (
                      <BarraGasto gasto={u.costo_usd} limite={lim} />
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      ${fmt(u.costo_usd)}
                    </span>
                    {lim > 0 && (
                      <p className={`text-xs ${u.costo_usd >= lim ? "text-red-500 font-semibold" : "text-zinc-400"}`}>
                        límite: ${fmt(lim)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Proveedores sin orden predefinido */}
            {usoProveedores.filter((u) => !PROVEEDORES_ORDEN.includes(u.proveedor)).map((u) => (
              <div key={u.proveedor} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{u.proveedor}</p>
                  <p className="text-xs text-zinc-400">{u.eventos} eventos</p>
                </div>
                <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  ${fmt(u.costo_usd)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── LÍMITES DE GASTO ── */}
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-semibold">Límites de gasto mensuales</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Cuando el gasto de un proveedor supere el límite, las llamadas/acciones se bloquean automáticamente.
          Dejá en 0 para sin límite.
        </p>
        <form onSubmit={(e) => void guardarLimites(e)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVEEDORES_ORDEN.map((p) => (
              <label key={p} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs text-zinc-600 dark:text-zinc-400">
                  {LABEL_PROVEEDOR[p] ?? p}
                </span>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={limitesEdit[p] ?? ""}
                    onChange={(e) => setLimitesEdit((prev) => ({ ...prev, [p]: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-6 pr-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={guardandoLimites}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {guardandoLimites ? "Guardando…" : "Guardar límites"}
            </button>
            {msgLimites && (
              <p className={`text-sm ${msgLimites.tipo === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
                {msgLimites.texto}
              </p>
            )}
          </div>
        </form>
      </section>

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
