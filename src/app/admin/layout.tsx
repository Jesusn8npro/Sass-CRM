import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerSesionSuperAdmin } from "@/lib/admin/sesion";

/**
 * Layout del panel /admin (super-admins globales del SaaS).
 *
 * Guard: si el user logueado NO es super-admin → redirect al panel
 * normal. Si no hay sesión → login.
 */
export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesionSuperAdmin();
  if (!sesion) {
    // El user puede estar logueado pero no ser admin → al panel normal.
    // Si no está logueado, sesion va a ser null igual y mandamos a login.
    redirect("/app");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-zinc-900 text-zinc-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">👑</span>
            <div>
              <h1 className="font-semibold text-base">Panel Super-Admin</h1>
              <p className="text-xs text-zinc-400">{sesion.email}</p>
            </div>
          </div>
          <Link
            href="/app"
            className="text-xs text-zinc-300 hover:text-white underline"
          >
            Ir al panel normal
          </Link>
        </div>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 pb-3 flex flex-wrap gap-1 text-sm">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/usuarios">Usuarios</NavLink>
          <NavLink href="/admin/cuentas">Cuentas WA</NavLink>
          <NavLink href="/admin/ingresos">Ingresos</NavLink>
          <NavLink href="/admin/logs">Logs</NavLink>
        </nav>
      </header>
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-zinc-200 hover:bg-zinc-800 hover:text-white transition"
    >
      {children}
    </Link>
  );
}
