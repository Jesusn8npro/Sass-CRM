import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import { listarCuentas } from "@/lib/baseDatos";
import { CrearPrimeraCuenta } from "@/components/CrearPrimeraCuenta";

/**
 * Entrada al panel.
 *  - Sin cuentas → muestra "Crear primera cuenta".
 *  - 1 sola cuenta → redirige directo a /app/cuentas/{id}/conversaciones.
 *  - N > 1 cuentas → muestra selector.
 *
 * El sidebar global vive dentro de `/app/cuentas/[idCuenta]/layout.tsx`,
 * así que esta página NO lo renderiza.
 */
export default async function PaginaPanel() {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app");

  const cuentas = await listarCuentas(auth.id);

  // 1 cuenta → entrada directa
  if (cuentas.length === 1) {
    redirect(`/app/cuentas/${cuentas[0]!.id}/conversaciones`);
  }

  // 0 cuentas o N > 1 → mostramos selector / onboarding
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Sass-CRM
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {cuentas.length === 0
                ? "Empezá creando tu primera cuenta"
                : "Elegí qué cuenta querés gestionar"}
            </h1>
          </div>
          <Link
            href="/app/mi-cuenta"
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium hover:bg-white dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Mi cuenta
          </Link>
        </header>

        {cuentas.length === 0 ? (
          <SinCuentas />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {cuentas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/cuentas/${c.id}/conversaciones`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
                      {c.etiqueta.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.etiqueta}</p>
                      <p className="truncate font-mono text-xs text-zinc-500">
                        {c.telefono ? `+${c.telefono}` : "sin conectar"}
                      </p>
                    </div>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        c.estado === "conectado"
                          ? "bg-emerald-500"
                          : c.estado === "qr"
                          ? "bg-amber-500"
                          : "bg-zinc-300"
                      }`}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SinCuentas() {
  return <CrearPrimeraCuenta />;
}
