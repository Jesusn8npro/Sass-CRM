import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";

interface FilaPago {
  id: string;
  monto_usd: number;
  estado: string;
  tipo: string | null;
  creado_en: string;
  usuario_email: string;
}

interface ResumenIngresos {
  total_mes_usd: number;
  pagos_mes: number;
  total_total_usd: number;
  pagos_total: number;
  ultimos: FilaPago[];
}

async function obtenerResumen(): Promise<ResumenIngresos> {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const { data, error } = await db()
    .from("pagos")
    .select(
      "id, monto_usd, estado, tipo, creado_en, usuario_id, usuarios:usuario_id(email)",
    )
    .order("creado_en", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[admin/ingresos] error:", error);
    return {
      total_mes_usd: 0,
      pagos_mes: 0,
      total_total_usd: 0,
      pagos_total: 0,
      ultimos: [],
    };
  }
  const arr = (data ?? []) as Array<{
    id: string;
    monto_usd: number;
    estado: string;
    tipo: string | null;
    creado_en: string;
    usuarios: { email: string } | { email: string }[] | null;
  }>;

  let totalMes = 0;
  let pagosMes = 0;
  let totalTotal = 0;
  let pagosTotal = 0;

  for (const p of arr) {
    if (p.estado !== "completado") continue;
    totalTotal += Number(p.monto_usd ?? 0);
    pagosTotal++;
    if (new Date(p.creado_en) >= inicioMes) {
      totalMes += Number(p.monto_usd ?? 0);
      pagosMes++;
    }
  }

  const ultimos: FilaPago[] = arr.map((p) => {
    const u = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios;
    return {
      id: p.id,
      monto_usd: Number(p.monto_usd ?? 0),
      estado: p.estado,
      tipo: p.tipo,
      creado_en: p.creado_en,
      usuario_email: u?.email ?? "?",
    };
  });

  return {
    total_mes_usd: totalMes,
    pagos_mes: pagosMes,
    total_total_usd: totalTotal,
    pagos_total: pagosTotal,
    ultimos,
  };
}

export default async function PaginaIngresos() {
  const r = await obtenerResumen();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Ingresos</h2>
        <p className="text-sm text-zinc-500">
          Pagos completados y facturación
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="text-xs uppercase text-zinc-500">Mes actual</div>
          <div className="text-2xl font-bold mt-1">
            ${r.total_mes_usd.toFixed(2)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {r.pagos_mes} pagos
          </div>
        </div>
        <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs uppercase text-zinc-500">Histórico</div>
          <div className="text-2xl font-bold mt-1">
            ${r.total_total_usd.toFixed(2)}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {r.pagos_total} pagos
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-x-auto">
        <h3 className="px-4 pt-3 pb-2 font-semibold">Últimos 50 pagos</h3>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Usuario</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium text-right">Monto USD</th>
              <th className="px-4 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {r.ultimos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2 text-xs">
                  {new Date(p.creado_en).toLocaleString("es")}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {p.usuario_email}
                </td>
                <td className="px-4 py-2 capitalize">{p.tipo ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono">
                  ${p.monto_usd.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-xs capitalize">
                  {p.estado === "completado" ? (
                    <span className="text-emerald-600">✓ {p.estado}</span>
                  ) : (
                    <span className="text-zinc-500">{p.estado}</span>
                  )}
                </td>
              </tr>
            ))}
            {r.ultimos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No hay pagos todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
