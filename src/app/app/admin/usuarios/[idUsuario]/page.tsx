"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";

interface UsuarioDetalle {
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

interface CuentaDetalle {
  id: string;
  etiqueta: string;
  telefono: string | null;
  estado: string;
  ultimo_heartbeat: number | null;
  creada_en: string;
}

interface SaldoDetalle {
  cuenta_id: string;
  saldo: { saldo_actual: number; saldo_mensual: number } | null;
}

interface PagoDetalle {
  id: string;
  tipo: string;
  monto_usd: number;
  estado: string;
  creditos_otorgados: number;
  creado_en: string;
}

interface RespuestaDetalle {
  usuario: UsuarioDetalle;
  cuentas: CuentaDetalle[];
  saldos: SaldoDetalle[];
  pagos: PagoDetalle[];
}

export default function PaginaAdminDetalleUsuario() {
  const params = useParams<{ idUsuario: string }>();
  const idUsuario = params.idUsuario;
  const { exito, error: toastError } = useToast();
  const { confirmar } = useConfirm();

  const [datos, setDatos] = useState<RespuestaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [modalSaldo, setModalSaldo] = useState<{ cuentaId: string } | null>(
    null,
  );
  const [cantidadSaldo, setCantidadSaldo] = useState("100");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${idUsuario}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        toastError("No se pudo cargar el usuario");
        return;
      }
      setDatos((await res.json()) as RespuestaDetalle);
    } finally {
      setCargando(false);
    }
  }, [idUsuario, toastError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function ejecutarAccion(accion: "suspender" | "reactivar") {
    const ok = await confirmar({
      titulo:
        accion === "suspender" ? "Suspender usuario" : "Reactivar usuario",
      mensaje:
        accion === "suspender"
          ? "El usuario va a quedar suspendido (estado_billing). Sus cuentas no se borran."
          : "Volverá a activo. Sólo si confirmaste el pago manualmente.",
      variante: accion === "suspender" ? "peligro" : "neutro",
      textoConfirmar: accion === "suspender" ? "Suspender" : "Reactivar",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/usuarios/${idUsuario}`, {
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

  async function darSaldo() {
    if (!modalSaldo) return;
    const cantidad = Number(cantidadSaldo);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      toastError("Cantidad inválida");
      return;
    }
    const res = await fetch(`/api/admin/usuarios/${idUsuario}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "dar_saldo",
        cuentaId: modalSaldo.cuentaId,
        cantidadCreditos: cantidad,
      }),
    });
    if (res.ok) {
      exito(`Sumados ${cantidad} créditos`);
      setModalSaldo(null);
      setCantidadSaldo("100");
      await cargar();
    } else {
      toastError("No se pudo dar saldo");
    }
  }

  if (cargando) {
    return <p className="text-sm text-zinc-500 dark:text-white/50">Cargando…</p>;
  }
  if (!datos) {
    return <p className="text-sm text-zinc-500 dark:text-white/50">Usuario no encontrado.</p>;
  }

  const u = datos.usuario;
  const totalGastado = datos.pagos
    .filter((p) => p.estado === "aprobado")
    .reduce((acc, p) => acc + Number(p.monto_usd ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/app/admin/usuarios"
        className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80"
      >
        ← volver
      </Link>

      <header className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // detalle del usuario
        </p>
        <h1 className="font-display mt-2 break-all text-3xl italic leading-tight text-zinc-900 dark:text-white md:text-4xl">
          {u.email}
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
          plan {u.plan} · {u.estado_billing ?? "sin estado"} · alta{" "}
          {new Date(u.creado_en).toLocaleDateString("es-AR")}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {u.estado_billing === "suspendido" ? (
          <button
            type="button"
            onClick={() => void ejecutarAccion("reactivar")}
            className="rounded-full border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.12]"
          >
            Reactivar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void ejecutarAccion("suspender")}
            className="rounded-full border border-red-500/40 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/[0.06] dark:text-red-200 dark:hover:bg-red-400/[0.12]"
          >
            Suspender
          </button>
        )}
      </div>

      {/* DATOS DE BILLING */}
      <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // billing
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Fila k="Pasarela" v={u.pasarela ?? "—"} />
          <Fila k="Subscription ID" v={u.paypal_subscription_id ?? "—"} />
          <Fila
            k="Vence"
            v={u.vence_en ? new Date(u.vence_en).toLocaleDateString("es-AR") : "—"}
          />
          <Fila k="Total cobrado" v={`$${totalGastado.toFixed(2)} USD`} />
        </dl>
      </section>

      {/* CUPO DE CUENTAS WHATSAPP */}
      <CupoCuentasExtra
        idUsuario={u.id}
        emailUsuario={u.email}
        plan={u.plan}
        cuentasUsadas={datos.cuentas.length}
        cuentasExtraInicial={u.cuentas_extra_admin ?? 0}
        onActualizado={() => void cargar()}
      />

      {/* CUENTAS */}
      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // cuentas ({datos.cuentas.length})
        </h2>
        {datos.cuentas.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-white/40">El usuario no tiene cuentas.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr>
                  <th className="px-4 py-3">Etiqueta</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.cuentas.map((c) => {
                  const s = datos.saldos.find((sa) => sa.cuenta_id === c.id);
                  return (
                    <tr key={c.id} className="border-t border-zinc-100 dark:border-white/[0.04]">
                      <td className="px-4 py-3 text-zinc-900 dark:text-white">{c.etiqueta}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-white/70">
                        {c.telefono ? `+${c.telefono}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-zinc-600 dark:text-white/70">
                        {c.estado}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-white">
                        {s?.saldo
                          ? `${s.saldo.saldo_actual}/${s.saldo.saldo_mensual}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setModalSaldo({ cuentaId: c.id })}
                          className="rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.12]"
                        >
                          Dar saldo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* PAGOS */}
      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // pagos ({datos.pagos.length})
        </h2>
        {datos.pagos.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-white/40">Sin pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-right">Créditos</th>
                </tr>
              </thead>
              <tbody>
                {datos.pagos.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-100 dark:border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/60">
                      {new Date(p.creado_en).toLocaleString("es-AR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-zinc-700 dark:text-white/80">
                      {p.tipo}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                      <span className={pillPago(p.estado)}>{p.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-white">
                      ${Number(p.monto_usd).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-white/70">
                      {p.creditos_otorgados || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL DAR SALDO */}
      {modalSaldo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm dark:bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalSaldo(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Dar saldo manual
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-white/55">
              Sumar créditos a la cuenta seleccionada. Se loggea como
              ajuste manual del operador.
            </p>
            <label className="mt-5 block">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
                // créditos
              </span>
              <input
                type="number"
                min={1}
                value={cantidadSaldo}
                onChange={(e) => setCantidadSaldo(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white dark:focus:border-emerald-400/50"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalSaldo(null)}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 dark:border-white/15 dark:text-white/85 dark:hover:border-white/40 dark:hover:bg-white/[0.04]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void darSaldo()}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-500 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
              >
                Sumar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Card admin para asignar cuentas WhatsApp extra a un usuario sobre el
 * cupo de su plan. Llama a PATCH /api/admin/usuarios/[id] con accion
 * "set_cuentas_extra".
 */
function CupoCuentasExtra({
  idUsuario,
  emailUsuario,
  plan,
  cuentasUsadas,
  cuentasExtraInicial,
  onActualizado,
}: {
  idUsuario: string;
  emailUsuario: string;
  plan: string;
  cuentasUsadas: number;
  cuentasExtraInicial: number;
  onActualizado: () => void;
}) {
  const PLANES_LIMITE: Record<string, number> = {
    free: 1,
    pro: 10,
    business: Number.POSITIVE_INFINITY,
  };
  const limitePlan = PLANES_LIMITE[plan] ?? 1;
  const planIlimitado = !Number.isFinite(limitePlan);
  const [extra, setExtra] = useState(cuentasExtraInicial);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limiteEfectivo = planIlimitado
    ? Number.POSITIVE_INFINITY
    : (limitePlan as number) + extra;

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    try {
      const r = await fetch(`/api/admin/usuarios/${idUsuario}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "set_cuentas_extra",
          cuentasExtra: extra,
        }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No se pudo guardar");
        return;
      }
      setExito(true);
      setTimeout(() => setExito(false), 2500);
      onActualizado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
        // cupo de cuentas whatsapp
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-white/55">
        Otorgá cuentas adicionales sobre el cupo del plan{" "}
        <span className="font-semibold text-zinc-900 dark:text-white">{plan}</span>
        {" "}sin tener que upgradear al usuario.
      </p>

      {planIlimitado ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          El plan {plan} no tiene límite de cuentas — el cupo extra no aplica.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-white/[0.06]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Plan {plan}
              </p>
              <p className="mt-1 text-xl font-bold">{limitePlan}</p>
              <p className="text-[10px] text-zinc-500">cuentas base</p>
            </div>
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-500/40 dark:bg-emerald-500/[0.08]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Extra del admin
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                +{extra}
              </p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">
                otorgadas manualmente
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-white/[0.06]">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                Total disponible
              </p>
              <p className="mt-1 text-xl font-bold">
                {cuentasUsadas} / {limiteEfectivo as number}
              </p>
              <p className="text-[10px] text-zinc-500">
                {(limiteEfectivo as number) - cuentasUsadas} restantes
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-start gap-3 md:flex-row md:items-center">
            <label className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 dark:text-white/60">
              Cuentas extra para {emailUsuario}:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExtra((e) => Math.max(0, e - 1))}
                disabled={extra === 0}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg font-semibold text-zinc-700 hover:border-emerald-500/40 disabled:opacity-40 dark:border-white/15 dark:text-white/70"
                aria-label="Restar 1"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={100}
                value={extra}
                onChange={(e) =>
                  setExtra(
                    Math.max(
                      0,
                      Math.min(100, Math.floor(Number(e.target.value) || 0)),
                    ),
                  )
                }
                className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-center font-mono text-base text-zinc-900 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white"
              />
              <button
                type="button"
                onClick={() => setExtra((e) => Math.min(100, e + 1))}
                disabled={extra >= 100}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 text-lg font-semibold text-zinc-700 hover:border-emerald-500/40 disabled:opacity-40 dark:border-white/15 dark:text-white/70"
                aria-label="Sumar 1"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando || extra === cuentasExtraInicial}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-500 disabled:opacity-40 dark:bg-emerald-400 dark:text-black dark:hover:bg-emerald-300"
            >
              {guardando ? "Guardando…" : "Guardar cambio"}
            </button>
            {exito && (
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                ✓ guardado
              </span>
            )}
            {error && (
              <span className="text-xs text-red-700 dark:text-red-300">
                {error}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2 last:border-0 dark:border-white/[0.04]">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
        {k}
      </dt>
      <dd className="break-all font-mono text-xs text-zinc-700 dark:text-white/85">{v}</dd>
    </div>
  );
}

function pillPago(estado: string): string {
  const base =
    "inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wider";
  if (estado === "aprobado")
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  if (estado === "fallido" || estado === "cancelado")
    return `${base} border-red-500/40 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/[0.08] dark:text-red-200`;
  if (estado === "pendiente")
    return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/70`;
}
