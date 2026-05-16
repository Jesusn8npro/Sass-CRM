"use client";

import { useState } from "react";

export interface UsuarioDetalle {
  id: string;
  email: string;
  nombre: string | null;
  plan: string;
  estado_billing?: string;
  pasarela?: string | null;
  paypal_subscription_id?: string | null;
  vence_en?: string | null;
  creado_en: string;
  cuentas_extra_admin?: number;
}

export interface CuentaDetalle {
  id: string;
  etiqueta: string;
  telefono: string | null;
  estado: string;
  ultimo_heartbeat: number | null;
  creada_en: string;
}

export interface SaldoDetalle {
  cuenta_id: string;
  saldo: { saldo_actual: number; saldo_mensual: number } | null;
}

export interface PagoDetalle {
  id: string;
  tipo: string;
  monto_usd: number;
  estado: string;
  creditos_otorgados: number;
  creado_en: string;
}

export interface RespuestaDetalle {
  usuario: UsuarioDetalle;
  cuentas: CuentaDetalle[];
  saldos: SaldoDetalle[];
  pagos: PagoDetalle[];
}

export function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2 last:border-0 dark:border-white/[0.04]">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">{k}</dt>
      <dd className="break-all font-mono text-xs text-zinc-700 dark:text-white/85">{v}</dd>
    </div>
  );
}

export function pillPago(estado: string): string {
  const base = "inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wider";
  if (estado === "aprobado") return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  if (estado === "fallido" || estado === "cancelado") return `${base} border-red-500/40 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/[0.08] dark:text-red-200`;
  if (estado === "pendiente") return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/70`;
}

export function CupoCuentasExtra({ idUsuario, emailUsuario, plan, cuentasUsadas, cuentasExtraInicial, onActualizado }: {
  idUsuario: string; emailUsuario: string; plan: string; cuentasUsadas: number; cuentasExtraInicial: number; onActualizado: () => void;
}) {
  const PLANES_LIMITE: Record<string, number> = { free: 1, pro: 10, business: Number.POSITIVE_INFINITY };
  const limitePlan = PLANES_LIMITE[plan] ?? 1;
  const planIlimitado = !Number.isFinite(limitePlan);
  const [extra, setExtra] = useState(cuentasExtraInicial);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limiteEfectivo = planIlimitado ? Number.POSITIVE_INFINITY : (limitePlan as number) + extra;

  async function guardar() {
    if (guardando) return;
    setGuardando(true); setError(null); setExito(false);
    try {
      const r = await fetch(`/api/admin/usuarios/${idUsuario}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "set_cuentas_extra", cuentasExtra: extra }) });
      if (!r.ok) { const data = (await r.json().catch(() => ({}))) as { error?: string }; setError(data.error ?? "No se pudo guardar"); return; }
      setExito(true); setTimeout(() => setExito(false), 2500); onActualizado();
    } catch (err) { setError(err instanceof Error ? err.message : "Error de red"); } finally { setGuardando(false); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">// cupo de cuentas whatsapp</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-white/55">Otorgá cuentas adicionales sobre el cupo del plan <span className="font-semibold text-zinc-900 dark:text-white">{plan}</span> sin tener que upgradear al usuario.</p>

      {planIlimitado ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">El plan {plan} no tiene límite de cuentas — el cupo extra no aplica.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-white/[0.06]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Plan {plan}</p>
              <p className="mt-1 text-xl font-bold">{limitePlan}</p>
              <p className="text-[10px] text-zinc-500">cuentas base</p>
            </div>
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Extra del admin</p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">+{extra}</p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">otorgadas manualmente</p>
            </div>
            <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-white/[0.06]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Total disponible</p>
              <p className="mt-1 text-xl font-bold">{cuentasUsadas} / {limiteEfectivo as number}</p>
              <p className="text-[10px] text-zinc-500">{(limiteEfectivo as number) - cuentasUsadas} restantes</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-start gap-3 md:flex-row md:items-center">
            <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 dark:text-white/60">Cuentas extra para {emailUsuario}:</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setExtra((e) => Math.max(0, e - 1))} disabled={extra === 0} className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg font-semibold text-zinc-700 hover:border-emerald-500/40 disabled:opacity-40 dark:border-white/15 dark:text-white/70" aria-label="Restar 1">−</button>
              <input type="number" min={0} max={100} value={extra} onChange={(e) => setExtra(Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))))} className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-center font-mono text-base text-zinc-900 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white" />
              <button type="button" onClick={() => setExtra((e) => Math.min(100, e + 1))} disabled={extra >= 100} className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg font-semibold text-zinc-700 hover:border-emerald-500/40 disabled:opacity-40 dark:border-white/15 dark:text-white/70" aria-label="Sumar 1">+</button>
            </div>
            <button type="button" onClick={() => void guardar()} disabled={guardando || extra === cuentasExtraInicial} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-500 disabled:opacity-40 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300">{guardando ? "Guardando…" : "Guardar cambio"}</button>
            {exito && <span className="text-xs text-emerald-700 dark:text-emerald-300">✓ guardado</span>}
            {error && <span className="text-xs text-red-700 dark:text-red-300">{error}</span>}
          </div>
        </>
      )}
    </section>
  );
}
