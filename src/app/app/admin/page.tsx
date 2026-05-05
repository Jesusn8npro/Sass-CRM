import {
  contarCuentasActivasGlobal,
  contarUsuariosPorPlan,
  listarUsoMesGlobal,
  sumaCostoIaGlobal,
  sumarPagosAprobados,
} from "@/lib/baseDatos";
import { PLANES } from "@/lib/paypal/planes";

const SIETE_DIAS_SEG = 7 * 24 * 60 * 60;

/**
 * Dashboard del panel admin: snapshot global del SaaS. Server component
 * puro, sin polling — quien quiera frescura recarga.
 */
export default async function PaginaAdminInicio() {
  const ahora = new Date();
  const desdeUltMes = new Date(
    ahora.getFullYear(),
    ahora.getMonth() - 1,
    ahora.getDate(),
  ).toISOString();

  const [usuariosPorPlan, cobranzasMes, costoIaMes, costoPorProveedor, cuentasActivas] =
    await Promise.all([
      contarUsuariosPorPlan(),
      sumarPagosAprobados(desdeUltMes),
      sumaCostoIaGlobal(desdeUltMes),
      listarUsoMesGlobal(desdeUltMes),
      contarCuentasActivasGlobal(SIETE_DIAS_SEG),
    ]);

  const mrrEstimado =
    usuariosPorPlan.pro * PLANES.pro.precioMensualUsd +
    usuariosPorPlan.business * PLANES.business.precioMensualUsd;

  const totalUsuarios =
    usuariosPorPlan.free + usuariosPorPlan.pro + usuariosPorPlan.business;

  const margenMes = cobranzasMes - costoIaMes;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // dashboard global
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Estado del SaaS
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-white/55">
          Snapshot del último mes. MRR es estimación pura: precio del plan
          activo × usuarios pagos. No descuenta churn ni reembolsos.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Tarjeta
          etiqueta="// usuarios totales"
          valor={String(totalUsuarios)}
          detalle={`free ${usuariosPorPlan.free} · pro ${usuariosPorPlan.pro} · business ${usuariosPorPlan.business}`}
        />
        <Tarjeta
          etiqueta="// mrr estimado"
          valor={formatearUsd(mrrEstimado)}
          detalle={`${usuariosPorPlan.pro} pro × $${PLANES.pro.precioMensualUsd} + ${usuariosPorPlan.business} business × $${PLANES.business.precioMensualUsd}`}
        />
        <Tarjeta
          etiqueta="// cuentas activas (7d)"
          valor={String(cuentasActivas)}
          detalle="con heartbeat reciente"
        />
        <Tarjeta
          etiqueta="// cobranzas último mes"
          valor={formatearUsd(cobranzasMes)}
          detalle="suma pagos aprobados"
          acento="emerald"
        />
        <Tarjeta
          etiqueta="// costo ia último mes"
          valor={formatearUsd(costoIaMes)}
          detalle={`${costoPorProveedor.length} proveedores`}
          acento="amber"
        />
        <Tarjeta
          etiqueta="// margen bruto mes"
          valor={formatearUsd(margenMes)}
          detalle={
            cobranzasMes > 0
              ? `${((margenMes / cobranzasMes) * 100).toFixed(1)}% sobre ingresos`
              : "sin ingresos"
          }
          acento={margenMes >= 0 ? "emerald" : "rojo"}
        />
      </section>

      {costoPorProveedor.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
            // costo ia por proveedor (último mes)
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-right">Eventos</th>
                  <th className="px-4 py-3 text-right">Costo (USD)</th>
                </tr>
              </thead>
              <tbody>
                {costoPorProveedor
                  .slice()
                  .sort((a, b) => b.costo_usd - a.costo_usd)
                  .map((p) => (
                    <tr key={p.proveedor} className="border-t border-zinc-100 dark:border-white/[0.04]">
                      <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider text-zinc-900 dark:text-white">
                        {p.proveedor}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-white/70">
                        {p.eventos.toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-900 dark:text-white">
                        {formatearUsd(p.costo_usd)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  detalle,
  acento,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  acento?: "emerald" | "amber" | "rojo";
}) {
  const acentoColor =
    acento === "emerald"
      ? "text-emerald-600 dark:text-emerald-300"
      : acento === "amber"
      ? "text-amber-600 dark:text-amber-300"
      : acento === "rojo"
      ? "text-red-600 dark:text-red-300"
      : "text-zinc-900 dark:text-white";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
        {etiqueta}
      </p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${acentoColor}`}>
        {valor}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
        {detalle}
      </p>
    </div>
  );
}

function formatearUsd(monto: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: monto >= 100 ? 0 : 2,
  }).format(monto);
}
