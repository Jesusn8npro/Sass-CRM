import Link from "next/link";
import { redirect } from "next/navigation";
import {
  esUsuarioAdmin,
  obtenerUsuarioActual,
} from "@/lib/auth/sesion";
import { listarCuentas, obtenerEstadoOnboarding } from "@/lib/baseDatos";
import { CrearPrimeraCuenta } from "@/components/CrearPrimeraCuenta";

/**
 * Entrada al panel.
 *  - Sin sesión → /login.
 *  - Admin sin cuentas propias → muestra selector con dos opciones:
 *      "Ir al panel admin" o "Crear cuenta WhatsApp (modo cliente)".
 *  - Cliente con onboarding pendiente y sin cuentas conectadas → /onboarding.
 *  - 0 cuentas (cliente) → "Crear primera cuenta".
 *  - 1 sola cuenta → redirige directo a /app/cuentas/{id}/conversaciones.
 *  - N > 1 cuentas → muestra selector.
 *
 * El sidebar global vive dentro de `/app/cuentas/[idCuenta]/layout.tsx`,
 * así que esta página NO lo renderiza.
 */
export default async function PaginaPanel() {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app");

  const esAdmin = await esUsuarioAdmin(auth.id);
  const cuentas = await listarCuentas(auth.id);

  // El admin NO se redirige automáticamente — puede operar como cliente
  // si tiene cuentas, o elegir entrar al panel admin desde el sidebar.
  // Si el cliente normal aún no terminó el onboarding y no tiene ninguna
  // cuenta conectada, lo mandamos al wizard.
  if (!esAdmin) {
    const estadoOnboarding = await obtenerEstadoOnboarding(auth.id);
    const algunaConectada = cuentas.some((c) => c.estado === "conectado");
    if (!estadoOnboarding.completo && !algunaConectada) {
      redirect("/onboarding");
    }
  }

  // 1 cuenta → entrada directa (vale para admin con 1 cuenta también).
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
              Sass-CRM {esAdmin && <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-px text-emerald-700 dark:text-emerald-300">ADMIN</span>}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {cuentas.length === 0
                ? esAdmin
                  ? "Hola admin — ¿qué querés hacer?"
                  : "Empezá creando tu primera cuenta"
                : "Elegí qué cuenta querés gestionar"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {esAdmin && (
              <Link
                href="/app/admin"
                className="rounded-full border border-emerald-500/40 bg-emerald-500/5 px-4 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
              >
                Panel admin →
              </Link>
            )}
            <Link
              href="/app/mi-cuenta"
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium hover:bg-white dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Mi cuenta
            </Link>
          </div>
        </header>

        {cuentas.length === 0 ? (
          esAdmin ? (
            <SinCuentasAdmin />
          ) : (
            <SinCuentas />
          )
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
            {/* Card siempre visible para crear cuenta nueva. El límite
                del plan se valida en /app/cuentas/nueva (página dedicada
                que muestra CTA de upgrade si está lleno). */}
            <li>
              <Link
                href="/app/cuentas/nueva"
                className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/50 p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-500/60 hover:bg-emerald-50/40 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:bg-emerald-500/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-emerald-500/40 text-2xl text-emerald-600 dark:text-emerald-400">
                    +
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                      Conectar otra cuenta
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      Sumá un número de WhatsApp más
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          </ul>
        )}
      </div>
    </main>
  );
}

function SinCuentas() {
  return <CrearPrimeraCuenta />;
}

/**
 * Variante para el admin del SaaS sin cuentas WhatsApp propias.
 * Le muestra dos caminos: ir directo al panel admin (operar la
 * plataforma) o crear una cuenta WhatsApp si quiere usar el producto
 * como cliente también.
 */
function SinCuentasAdmin() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link
        href="/app/admin"
        className="group flex flex-col rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-500/60 hover:shadow-md dark:border-emerald-500/30"
      >
        <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          Modo admin
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight">Panel admin</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          KPIs globales, usuarios, ingresos y operación de la plataforma.
        </p>
        <span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 transition-transform group-hover:translate-x-1 dark:text-emerald-300">
          Entrar →
        </span>
      </Link>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Modo cliente
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight">
          Crear cuenta WhatsApp
        </h3>
        <p className="mt-1 mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Probá el producto como un usuario más: conectá un número y
          configurá tu agente IA.
        </p>
        <CrearPrimeraCuenta />
      </div>
    </div>
  );
}
