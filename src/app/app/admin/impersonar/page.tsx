import Link from "next/link";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface CuentaConUsuario {
  id: string;
  etiqueta: string;
  estado: string;
  telefono: string | null;
  creado_en: string;
  usuario_id: string;
  usuarios: { email: string } | null;
}

export default async function PaginaAdminImpersonar() {
  const sb = crearClienteAdmin();
  const { data } = await sb
    .from("cuentas")
    .select("id, etiqueta, estado, telefono, creado_en, usuario_id, usuarios(email)")
    .order("creado_en", { ascending: false });

  const cuentas = (data ?? []) as unknown as CuentaConUsuario[];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // cuentas del sistema
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Ver cuentas
        </h1>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
          {cuentas.length} cuentas registradas
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Etiqueta</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/35"
                >
                  sin cuentas
                </td>
              </tr>
            )}
            {cuentas.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-zinc-900 dark:text-white">{c.etiqueta}</td>
                <td className="px-4 py-3">
                  <span className={pillEstado(c.estado)}>{c.estado}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-white/60">
                  {c.telefono ? `+${c.telefono}` : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/60">
                  {c.usuarios?.email ?? c.usuario_id.slice(0, 8) + "…"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/app/admin/impersonar/${c.id}`}
                    className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 hover:text-emerald-700 dark:text-emerald-300"
                  >
                    ver dashboard →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pillEstado(estado: string): string {
  const base = "inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider";
  if (estado === "conectado")
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  if (estado === "qr")
    return `${base} border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/50`;
}
