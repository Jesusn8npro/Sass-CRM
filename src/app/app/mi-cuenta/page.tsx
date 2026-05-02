import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import {
  contarCuentasDeUsuario,
  obtenerUsuarioApp,
} from "@/lib/baseDatos";
import { obtenerPlan, formatearLimite } from "@/lib/planes";
import { FormularioPerfil } from "./FormularioPerfil";
import { CerrarSesionBoton } from "./CerrarSesionBoton";

export const dynamic = "force-dynamic";

/**
 * Página /app/mi-cuenta — perfil del usuario logueado, plan actual,
 * uso vs límite, y CTAs a precios / cambiar contraseña.
 *
 * Server Component: traemos los datos en el server, sin loading state.
 */
export default async function PaginaMiCuenta() {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app/mi-cuenta");

  const usuario = await obtenerUsuarioApp(auth.id);
  if (!usuario) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-red-600">
          No encontramos tu fila en `public.usuarios`. Eso suele pasar si el
          trigger `handle_nuevo_usuario` no se disparó. Avisanos.
        </p>
      </main>
    );
  }

  const plan = obtenerPlan(usuario.plan);
  const cuentasUsadas = await contarCuentasDeUsuario(auth.id);
  const porcentaje = Number.isFinite(plan.limite_cuentas)
    ? Math.min(100, Math.round((cuentasUsadas / plan.limite_cuentas) * 100))
    : 0;
  const lleno = cuentasUsadas >= plan.limite_cuentas;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Topbar */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span>←</span> Volver al panel
          </Link>
          <h1 className="text-base font-semibold">Mi cuenta</h1>
          <span className="w-24" /> {/* spacer para centrar el título */}
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {/* Perfil */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-lg font-semibold">Perfil</h2>
          <p className="mb-5 text-xs text-zinc-500">
            Cambios visibles solo para vos.
          </p>

          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-md">
              {(usuario.nombre || usuario.email).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">
                {usuario.nombre || "Sin nombre cargado"}
              </p>
              <p className="font-mono text-xs text-zinc-500">{usuario.email}</p>
            </div>
          </div>

          <FormularioPerfil
            nombreInicial={usuario.nombre ?? ""}
          />

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
            <div>
              <p className="text-zinc-500">Rol</p>
              <p className="mt-0.5 font-medium uppercase tracking-wider">
                {usuario.rol}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Miembro desde</p>
              <p className="mt-0.5 font-medium">
                {new Date(usuario.creado_en).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </section>

        {/* Plan + uso */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Plan actual</h2>
              <p className="text-xs text-zinc-500">{plan.resumen}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                plan.id === "free"
                  ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  : plan.id === "pro"
                  ? "bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              }`}
            >
              {plan.nombre}
            </span>
          </div>

          {/* Uso de cuentas */}
          <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Cuentas WhatsApp</span>
              <span className="font-mono text-zinc-500">
                {cuentasUsadas} / {formatearLimite(plan.limite_cuentas)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full transition-all ${
                  lleno
                    ? "bg-amber-500"
                    : porcentaje > 70
                    ? "bg-amber-400"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${
                    Number.isFinite(plan.limite_cuentas) ? porcentaje : 5
                  }%`,
                }}
              />
            </div>
            {lleno && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Llegaste al límite. Actualizá tu plan para crear más cuentas.
              </p>
            )}
          </div>

          {/* Beneficios incluidos */}
          <ul className="space-y-2 text-sm">
            {plan.beneficios.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                  />
                </svg>
                <span className="text-zinc-700 dark:text-zinc-300">{b}</span>
              </li>
            ))}
          </ul>

          {plan.id !== "business" && (
            <Link
              href="/#precios"
              className="mt-6 block rounded-full bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition-all hover:bg-emerald-400"
            >
              {plan.id === "free"
                ? "Actualizar a Pro →"
                : "Ver plan Business →"}
            </Link>
          )}
        </section>

        {/* Sesión */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-lg font-semibold">Sesión</h2>
          <p className="mb-5 text-xs text-zinc-500">
            Cerrá sesión en este dispositivo.
          </p>
          <CerrarSesionBoton />
        </section>
      </div>
    </main>
  );
}
