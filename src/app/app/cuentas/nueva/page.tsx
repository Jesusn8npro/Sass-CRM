import Link from "next/link";
import { redirect } from "next/navigation";
import {
  esUsuarioAdmin,
  obtenerUsuarioActual,
} from "@/lib/auth/sesion";
import {
  contarCuentasDeUsuario,
  obtenerUsuarioApp,
} from "@/lib/baseDatos";
import { obtenerPlan } from "@/lib/planes";
import { FormularioNuevaCuenta } from "./_componentes/FormularioNuevaCuenta";

/**
 * Página dedicada para crear una nueva cuenta de WhatsApp.
 *
 * - Si el usuario ya tocó su límite de plan (y NO es admin), muestra
 *   un CTA al upgrade en vez del formulario.
 * - Si tiene cupo, formulario simple → POST /api/cuentas → redirect
 *   a /app/cuentas/{id}/whatsapp para escanear el QR.
 *
 * El admin de la plataforma (rol = admin_plataforma) tiene cupo
 * ILIMITADO independiente del plan.
 */
export default async function PaginaNuevaCuenta() {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app/cuentas/nueva");

  const [esAdmin, usuario, usadas] = await Promise.all([
    esUsuarioAdmin(auth.id),
    obtenerUsuarioApp(auth.id),
    contarCuentasDeUsuario(auth.id),
  ]);
  const plan = obtenerPlan(usuario?.plan);
  const limite = Number.isFinite(plan.limite_cuentas)
    ? plan.limite_cuentas
    : null;
  const lleno = !esAdmin && limite !== null && usadas >= limite;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-8">
          <Link
            href="/app"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            ← volver al panel
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            Conectar nueva cuenta de WhatsApp
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Cada cuenta es un número independiente con su propio agente IA,
            catálogo, conversaciones y configuración.
          </p>
        </header>

        {/* Estado del plan */}
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Plan {plan.nombre}
              </p>
              <p className="mt-1 text-sm">
                Cuentas: <span className="font-semibold">{usadas}</span>
                {limite !== null && (
                  <>
                    {" "}
                    de <span className="font-semibold">{limite}</span>
                  </>
                )}
                {esAdmin && (
                  <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    admin · ilimitado
                  </span>
                )}
              </p>
            </div>
            {!esAdmin && limite !== null && (
              <Link
                href="/app/mi-cuenta/upgrade"
                className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/5 dark:hover:text-emerald-300"
              >
                Subir de plan
              </Link>
            )}
          </div>
        </div>

        {/* Formulario o bloqueo */}
        {lleno ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-700/40 dark:bg-amber-900/10">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              🔒 Llegaste al límite de tu plan
            </p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300/80">
              Tu plan <strong>{plan.nombre}</strong> permite hasta{" "}
              <strong>{limite}</strong> cuenta{limite === 1 ? "" : "s"} de
              WhatsApp. Para conectar más, subí a un plan superior.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/app/mi-cuenta/upgrade"
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400"
              >
                Ver planes →
              </Link>
              <Link
                href="/app"
                className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancelar
              </Link>
            </div>
          </div>
        ) : (
          <FormularioNuevaCuenta />
        )}
      </div>
    </main>
  );
}
