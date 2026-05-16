import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface Suscriptor {
  id: string;
  email: string;
  confirmado: boolean;
  creado_en: string;
  desuscrito_en: string | null;
}

export default async function PaginaAdminSuscriptores() {
  const sb = crearClienteAdmin();
  const { data } = await sb
    .from("suscriptores_blog")
    .select("*")
    .order("creado_en", { ascending: false });

  const suscriptores = (data ?? []) as Suscriptor[];

  const total = suscriptores.length;
  const confirmados = suscriptores.filter((s) => s.confirmado).length;
  const activos = suscriptores.filter((s) => !s.desuscrito_en).length;
  const desuscritos = suscriptores.filter((s) => s.desuscrito_en !== null).length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // suscriptores blog
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Suscriptores
        </h1>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta etiqueta="// total" valor={String(total)} />
        <Tarjeta etiqueta="// confirmados" valor={String(confirmados)} acento="emerald" />
        <Tarjeta etiqueta="// activos" valor={String(activos)} acento="emerald" />
        <Tarjeta etiqueta="// desuscritos" valor={String(desuscritos)} acento="rojo" />
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Registro</th>
            </tr>
          </thead>
          <tbody>
            {suscriptores.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/35"
                >
                  sin suscriptores
                </td>
              </tr>
            )}
            {suscriptores.map((s) => (
              <tr key={s.id} className="border-t border-zinc-100 dark:border-white/[0.04]">
                <td className="px-4 py-3 text-zinc-900 dark:text-white">{s.email}</td>
                <td className="px-4 py-3">
                  <span className={pillEstado(s)}>
                    {s.desuscrito_en ? "desuscrito" : s.confirmado ? "confirmado" : "pendiente"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                  {new Date(s.creado_en).toLocaleDateString("es-AR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  acento,
}: {
  etiqueta: string;
  valor: string;
  acento?: "emerald" | "rojo";
}) {
  const color =
    acento === "emerald"
      ? "text-emerald-600 dark:text-emerald-300"
      : acento === "rojo"
      ? "text-red-600 dark:text-red-300"
      : "text-zinc-900 dark:text-white";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
        {etiqueta}
      </p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${color}`}>{valor}</p>
    </div>
  );
}

function pillEstado(s: Suscriptor): string {
  const base = "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider";
  if (s.desuscrito_en)
    return `${base} border-red-500/40 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/[0.08] dark:text-red-200`;
  if (s.confirmado)
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
}
