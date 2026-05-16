import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface WebhookFila {
  esta_activo: boolean;
  ultimo_resultado: string | null;
  total_disparos: number;
  total_fallos: number;
}

interface WebhookTop {
  cuenta_id: string;
  url: string;
  total_fallos: number;
  ultimo_resultado: string | null;
}

interface CuentaFila {
  estado: string;
}

export default async function PaginaAdminSalud() {
  const sb = crearClienteAdmin();

  const [{ data: webhooksRaw }, { data: cuentasRaw }, { data: webhooksTop }] = await Promise.all([
    sb.from("webhooks_salientes").select("esta_activo, ultimo_resultado, total_disparos, total_fallos"),
    sb.from("cuentas").select("estado"),
    sb
      .from("webhooks_salientes")
      .select("cuenta_id, url, total_fallos, ultimo_resultado")
      .gt("total_fallos", 0)
      .order("total_fallos", { ascending: false })
      .limit(10),
  ]);

  const webhooks = (webhooksRaw ?? []) as WebhookFila[];
  const cuentas = (cuentasRaw ?? []) as CuentaFila[];
  const top10 = (webhooksTop ?? []) as WebhookTop[];

  const totalWebhooks = webhooks.length;
  const webhooksActivos = webhooks.filter((w) => w.esta_activo).length;
  const webhooksConFallos = webhooks.filter((w) => w.total_fallos > 0).length;
  const sumaDisparos = webhooks.reduce((acc, w) => acc + (w.total_disparos ?? 0), 0);
  const sumaFallos = webhooks.reduce((acc, w) => acc + (w.total_fallos ?? 0), 0);
  const tasaFallo = sumaDisparos > 0 ? (sumaFallos / sumaDisparos) * 100 : 0;

  const conectadas = cuentas.filter((c) => c.estado === "conectado").length;
  const enQr = cuentas.filter((c) => c.estado === "qr").length;
  const desconectadas = cuentas.filter(
    (c) => c.estado !== "conectado" && c.estado !== "qr",
  ).length;
  const totalCuentas = cuentas.length;
  const uptimePct = totalCuentas > 0 ? Math.round((conectadas / totalCuentas) * 100) : 0;

  const maxConectividad = Math.max(conectadas, enQr, desconectadas, 1);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // salud del sistema
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Estado operativo
        </h1>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta etiqueta="// webhooks total" valor={String(totalWebhooks)} detalle={`${webhooksActivos} activos`} />
        <Tarjeta
          etiqueta="// con fallos"
          valor={String(webhooksConFallos)}
          detalle="al menos 1 fallo"
          acento={webhooksConFallos > 0 ? "rojo" : undefined}
        />
        <Tarjeta
          etiqueta="// tasa fallo"
          valor={`${tasaFallo.toFixed(1)}%`}
          detalle={`${sumaFallos} / ${sumaDisparos} disparos`}
          acento={tasaFallo > 10 ? "rojo" : tasaFallo > 0 ? "amber" : undefined}
        />
        <Tarjeta
          etiqueta="// cuentas conectadas"
          valor={`${uptimePct}%`}
          detalle={`${conectadas} de ${totalCuentas}`}
          acento={uptimePct >= 80 ? "emerald" : uptimePct >= 50 ? "amber" : "rojo"}
        />
      </section>

      <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // distribución de cuentas por estado
        </p>
        <div className="space-y-3">
          <BarraEstado label="conectado" valor={conectadas} maximo={maxConectividad} color="emerald" />
          <BarraEstado label="qr / reconectando" valor={enQr} maximo={maxConectividad} color="amber" />
          <BarraEstado label="desconectado / otro" valor={desconectadas} maximo={maxConectividad} color="rojo" />
        </div>
      </section>

      {top10.length > 0 && (
        <section>
          <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
            // top 10 webhooks con más fallos
          </h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr>
                  <th className="px-4 py-3">Cuenta</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3 text-right">Fallos</th>
                  <th className="px-4 py-3">Último resultado</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((w, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/60">
                      {w.cuenta_id.slice(0, 8)}…
                    </td>
                    <td className="max-w-xs px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/60">
                      <span className="block truncate" title={w.url}>
                        {w.url}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-red-600 dark:text-red-300">
                      {w.total_fallos}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/40">
                      {w.ultimo_resultado ?? "—"}
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
  detalle?: string;
  acento?: "emerald" | "amber" | "rojo";
}) {
  const color =
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
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${color}`}>{valor}</p>
      {detalle && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
          {detalle}
        </p>
      )}
    </div>
  );
}

function BarraEstado({
  label,
  valor,
  maximo,
  color,
}: {
  label: string;
  valor: number;
  maximo: number;
  color: "emerald" | "amber" | "rojo";
}) {
  const pct = Math.round((valor / maximo) * 100);
  const barColor =
    color === "emerald"
      ? "border-l-2 border-emerald-400 bg-emerald-500/20"
      : color === "amber"
      ? "border-l-2 border-amber-400 bg-amber-500/20"
      : "border-l-2 border-red-400 bg-red-500/20";

  return (
    <div className="flex items-center gap-3">
      <span className="w-44 shrink-0 font-mono text-[10px] text-zinc-600 dark:text-white/55">
        {label}
      </span>
      <div className="relative h-[18px] flex-1 rounded-sm bg-zinc-100 dark:bg-white/[0.04]">
        <div className={`absolute inset-y-0 left-0 rounded-sm ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-[10px] text-zinc-500 dark:text-white/40">
        {valor}
      </span>
    </div>
  );
}
