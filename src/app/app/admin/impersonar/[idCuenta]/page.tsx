import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface CuentaDetalle {
  id: string;
  etiqueta: string;
  estado: string;
  telefono: string | null;
  usuarios: { email: string } | null;
}

interface ConversacionReciente {
  id: string;
  creado_en: string;
  nombre: string | null;
  telefono: string | null;
  ultimo_mensaje_en: string | null;
}

export default async function PaginaAdminVerCuenta({
  params,
}: {
  params: Promise<{ idCuenta: string }>;
}) {
  const { idCuenta } = await params;
  const sb = crearClienteAdmin();

  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: cuentaRaw }, { count: totalConversaciones }, { data: recientesRaw }, { count: mensajes7d }] =
    await Promise.all([
      sb
        .from("cuentas")
        .select("id, etiqueta, estado, telefono, usuarios(email)")
        .eq("id", idCuenta)
        .single(),
      sb
        .from("conversaciones")
        .select("id", { count: "exact", head: true })
        .eq("cuenta_id", idCuenta),
      sb
        .from("conversaciones")
        .select("id, creado_en, nombre, telefono, ultimo_mensaje_en")
        .eq("cuenta_id", idCuenta)
        .order("creado_en", { ascending: false })
        .limit(10),
      sb
        .from("mensajes")
        .select("id", { count: "exact", head: true })
        .eq("cuenta_id", idCuenta)
        .gte("creado_en", hace7dias),
    ]);

  if (!cuentaRaw) notFound();

  const cuenta = cuentaRaw as unknown as CuentaDetalle;
  const recientes = (recientesRaw ?? []) as ConversacionReciente[];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/app/admin/impersonar"
        className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80"
      >
        ← volver a cuentas
      </Link>

      <header className="mt-6 mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // viendo cuenta: {cuenta.etiqueta}
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          {cuenta.etiqueta}
        </h1>
      </header>

      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-400/20 dark:bg-amber-400/[0.06]">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
          Modo vista — solo lectura
        </span>
        <span className="font-mono text-[10px] text-amber-600/70 dark:text-amber-300/60">
          Estás viendo esta cuenta como administrador. No podés realizar acciones en nombre del usuario.
        </span>
      </div>

      <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // info de la cuenta
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Fila k="Etiqueta" v={cuenta.etiqueta} />
          <Fila k="Estado" v={cuenta.estado} />
          <Fila k="Teléfono" v={cuenta.telefono ? `+${cuenta.telefono}` : "—"} />
          <Fila k="Owner" v={cuenta.usuarios?.email ?? "—"} />
        </dl>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tarjeta etiqueta="// conversaciones" valor={String(totalConversaciones ?? 0)} />
        <Tarjeta etiqueta="// mensajes (7d)" valor={String(mensajes7d ?? 0)} />
        <Tarjeta etiqueta="// recientes cargadas" valor={String(recientes.length)} />
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // últimas 10 conversaciones
        </h2>
        {recientes.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-white/40">Sin conversaciones.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
                <tr>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Últ. mensaje</th>
                  <th className="px-4 py-3">Creado</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((conv) => (
                  <tr key={conv.id} className="border-t border-zinc-100 dark:border-white/[0.04]">
                    <td className="px-4 py-3 text-zinc-900 dark:text-white">
                      {conv.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-white/60">
                      {conv.telefono ? `+${conv.telefono}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                      {conv.ultimo_mensaje_en
                        ? new Date(conv.ultimo_mensaje_en).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                      {new Date(conv.creado_en).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">{k}</dt>
      <dd className="text-zinc-900 dark:text-white">{v}</dd>
    </div>
  );
}

function Tarjeta({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
        {etiqueta}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        {valor}
      </p>
    </div>
  );
}
