import { obtenerMetricasGlobales } from "@/lib/admin/reportes";

/**
 * Dashboard del super-admin: snapshot de toda la plataforma.
 * Server component — fetch directo a DB sin pasar por API.
 */
export const dynamic = "force-dynamic"; // datos en vivo, no cachear

export default async function PaginaDashboardAdmin() {
  const m = await obtenerMetricasGlobales();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-zinc-500">
          Snapshot global del SaaS · datos en vivo
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TarjetaMetrica
          titulo="Usuarios"
          valor={m.usuarios_total}
          sub={`${m.usuarios_con_cuenta} con cuenta WA`}
        />
        <TarjetaMetrica
          titulo="Nuevos 24h"
          valor={m.usuarios_nuevos_24h}
          sub="Registros recientes"
        />
        <TarjetaMetrica
          titulo="Cuentas WA"
          valor={m.cuentas_total}
          sub={`${m.cuentas_activas} activas`}
        />
        <TarjetaMetrica
          titulo="🟢 Conectadas"
          valor={m.cuentas_conectadas}
          sub={m.cuentas_caidas > 0 ? `⚠ ${m.cuentas_caidas} caídas` : "OK"}
          alerta={m.cuentas_caidas > 0}
        />
        <TarjetaMetrica
          titulo="Mensajes 24h"
          valor={m.mensajes_24h.toLocaleString("es")}
        />
        <TarjetaMetrica
          titulo="Convs activas 24h"
          valor={m.conversaciones_activas_24h}
        />
        <TarjetaMetrica
          titulo="Esperando humano"
          valor={m.conversaciones_en_humano}
          alerta={m.conversaciones_en_humano > 5}
        />
        <TarjetaMetrica
          titulo="Citas 24h"
          valor={m.citas_agendadas_24h}
        />
        <TarjetaMetrica
          titulo="Leads Apify 24h"
          valor={m.leads_apify_24h}
        />
        <TarjetaMetrica
          titulo="Créditos 24h"
          valor={m.creditos_consumidos_24h.toLocaleString("es")}
        />
        <TarjetaMetrica
          titulo="Pagos del mes"
          valor={m.pagos_mes_count}
        />
        <TarjetaMetrica
          titulo="💰 Mes (USD)"
          valor={`$${m.ingresos_mes_usd.toFixed(2)}`}
          destacado
        />
      </div>

      <section className="rounded-xl border bg-white dark:bg-zinc-900 p-4">
        <h3 className="font-semibold mb-2">Control por WhatsApp</h3>
        <p className="text-sm text-zinc-500 mb-3">
          Escribí estos comandos desde tu WhatsApp (<code className="text-xs">+573123790071</code>)
          a cualquier número conectado al SaaS:
        </p>
        <ul className="text-sm space-y-1 font-mono">
          <li><code>/reporte</code> · resumen completo del día</li>
          <li><code>/usuarios</code> · cantidad de users</li>
          <li><code>/cuentas</code> · estado de números WA</li>
          <li><code>/ingresos</code> · facturación del mes</li>
          <li><code>/alertas</code> · cuentas caídas (&gt;30 min)</li>
          <li><code>/ayuda</code> · esta lista</li>
        </ul>
        <p className="text-xs text-zinc-500 mt-3">
          ⏰ Reporte diario automático: entre 8am y 10am hora del server.
        </p>
      </section>
    </div>
  );
}

function TarjetaMetrica({
  titulo,
  valor,
  sub,
  alerta,
  destacado,
}: {
  titulo: string;
  valor: number | string;
  sub?: string;
  alerta?: boolean;
  destacado?: boolean;
}) {
  const colorAlerta = alerta
    ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
    : destacado
      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"
      : "bg-white dark:bg-zinc-900";
  return (
    <div className={`rounded-xl border p-4 ${colorAlerta}`}>
      <div className="text-xs text-zinc-500 uppercase tracking-wide">
        {titulo}
      </div>
      <div className="text-2xl font-bold mt-1">{valor}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}
