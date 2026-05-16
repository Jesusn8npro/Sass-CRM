"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import type { RespuestaDetalle } from "./_helpers";
import { Fila, pillPago, CupoCuentasExtra } from "./_helpers";

export default function PaginaAdminDetalleUsuario() {
  const params = useParams<{ idUsuario: string }>();
  const idUsuario = params.idUsuario;
  const { exito, error: toastError } = useToast();
  const { confirmar } = useConfirm();

  const [datos, setDatos] = useState<RespuestaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [modalSaldo, setModalSaldo] = useState<{ cuentaId: string } | null>(null);
  const [cantidadSaldo, setCantidadSaldo] = useState("100");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${idUsuario}`, { cache: "no-store" });
      if (!res.ok) { toastError("No se pudo cargar el usuario"); return; }
      setDatos((await res.json()) as RespuestaDetalle);
    } finally { setCargando(false); }
  }, [idUsuario, toastError]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function ejecutarAccion(accion: "suspender" | "reactivar") {
    const ok = await confirmar({
      titulo: accion === "suspender" ? "Suspender usuario" : "Reactivar usuario",
      mensaje: accion === "suspender" ? "El usuario va a quedar suspendido (estado_billing). Sus cuentas no se borran." : "Volverá a activo. Sólo si confirmaste el pago manualmente.",
      variante: accion === "suspender" ? "peligro" : "neutro",
      textoConfirmar: accion === "suspender" ? "Suspender" : "Reactivar",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/usuarios/${idUsuario}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }) });
    if (res.ok) { exito(accion === "suspender" ? "Usuario suspendido" : "Usuario reactivado"); await cargar(); }
    else { toastError("Acción falló"); }
  }

  async function darSaldo() {
    if (!modalSaldo) return;
    const cantidad = Number(cantidadSaldo);
    if (!Number.isFinite(cantidad) || cantidad <= 0) { toastError("Cantidad inválida"); return; }
    const res = await fetch(`/api/admin/usuarios/${idUsuario}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "dar_saldo", cuentaId: modalSaldo.cuentaId, cantidadCreditos: cantidad }) });
    if (res.ok) { exito(`Sumados ${cantidad} créditos`); setModalSaldo(null); setCantidadSaldo("100"); await cargar(); }
    else { toastError("No se pudo dar saldo"); }
  }

  if (cargando) return <p className="text-sm text-zinc-500 dark:text-white/50">Cargando…</p>;
  if (!datos) return <p className="text-sm text-zinc-500 dark:text-white/50">Usuario no encontrado.</p>;

  const u = datos.usuario;
  const totalGastado = datos.pagos.filter((p) => p.estado === "aprobado").reduce((acc, p) => acc + Number(p.monto_usd ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/admin/usuarios" className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80">← volver</Link>

      <header className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">// detalle del usuario</p>
        <h1 className="font-display mt-2 break-all text-3xl italic leading-tight text-zinc-900 dark:text-white md:text-4xl">{u.email}</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">plan {u.plan} · {u.estado_billing ?? "sin estado"} · alta {new Date(u.creado_en).toLocaleDateString("es-AR")}</p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {u.estado_billing === "suspendido" ? (
          <button type="button" onClick={() => void ejecutarAccion("reactivar")} className="rounded-full border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.12]">Reactivar</button>
        ) : (
          <button type="button" onClick={() => void ejecutarAccion("suspender")} className="rounded-full border border-red-500/40 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/[0.06] dark:text-red-200 dark:hover:bg-red-400/[0.12]">Suspender</button>
        )}
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">// billing</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Fila k="Pasarela" v={u.pasarela ?? "—"} />
          <Fila k="Subscription ID" v={u.paypal_subscription_id ?? "—"} />
          <Fila k="Vence" v={u.vence_en ? new Date(u.vence_en).toLocaleDateString("es-AR") : "—"} />
          <Fila k="Total cobrado" v={`$${totalGastado.toFixed(2)} USD`} />
        </dl>
      </section>

      <CupoCuentasExtra idUsuario={u.id} emailUsuario={u.email} plan={u.plan} cuentasUsadas={datos.cuentas.length} cuentasExtraInicial={u.cuentas_extra_admin ?? 0} onActualizado={() => void cargar()} />

      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">// cuentas ({datos.cuentas.length})</h2>
        {datos.cuentas.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-white/40">El usuario no tiene cuentas.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr><th className="px-4 py-3">Etiqueta</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-right">Acciones</th></tr>
              </thead>
              <tbody>
                {datos.cuentas.map((c) => {
                  const s = datos.saldos.find((sa) => sa.cuenta_id === c.id);
                  return (
                    <tr key={c.id} className="border-t border-zinc-100 dark:border-white/[0.04]">
                      <td className="px-4 py-3 text-zinc-900 dark:text-white">{c.etiqueta}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-white/70">{c.telefono ? `+${c.telefono}` : "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-zinc-600 dark:text-white/70">{c.estado}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-white">{s?.saldo ? `${s.saldo.saldo_actual}/${s.saldo.saldo_mensual}` : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setModalSaldo({ cuentaId: c.id })} className="rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.12]">Dar saldo</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">// pagos ({datos.pagos.length})</h2>
        {datos.pagos.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-white/40">Sin pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-right">Créditos</th></tr>
              </thead>
              <tbody>
                {datos.pagos.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-100 dark:border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/60">{new Date(p.creado_en).toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-zinc-700 dark:text-white/80">{p.tipo}</td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider"><span className={pillPago(p.estado)}>{p.estado}</span></td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-white">${Number(p.monto_usd).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-white/70">{p.creditos_otorgados || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalSaldo && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm dark:bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) setModalSaldo(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Dar saldo manual</h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">Sumar créditos a la cuenta seleccionada. Se loggea como ajuste manual del operador.</p>
            <label className="mt-5 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">// créditos</span>
              <input type="number" min={1} value={cantidadSaldo} onChange={(e) => setCantidadSaldo(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white dark:focus:border-emerald-400/50" />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalSaldo(null)} className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/15 dark:text-white/85 dark:hover:border-white/40 dark:hover:bg-white/[0.04]">Cancelar</button>
              <button type="button" onClick={() => void darSaldo()} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-500 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300">Sumar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
