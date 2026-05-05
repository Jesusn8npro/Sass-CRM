import { redirect } from "next/navigation";
import Link from "next/link";
import {
  esUsuarioAdmin,
  obtenerUsuarioActual,
} from "@/lib/auth/sesion";
import { InterruptorTema } from "@/components/InterruptorTema";

/**
 * Layout del panel de administración. Sólo accesible para usuarios con
 * `rol = 'admin_plataforma'` en `public.usuarios`. Para promover/revocar
 * un admin, hacé un UPDATE directo en Supabase — no requiere reiniciar.
 *
 *  - Sin sesión → /login
 *  - Logueado pero no admin → /app
 *
 * El layout y todas sus páginas hijas respetan el tema global (claro
 * /oscuro). Toggle en el sidebar admin.
 */
export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app/admin");
  if (!(await esUsuarioAdmin(auth.id))) redirect("/app");

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-black dark:text-white">
      <div className="mx-auto flex max-w-7xl">
        <SidebarAdmin emailAdmin={auth.email} />
        <main className="min-h-screen flex-1 px-6 py-10 md:px-10 md:py-14">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarAdmin({ emailAdmin }: { emailAdmin: string }) {
  const items: { href: string; label: string; clave: string }[] = [
    { href: "/app/admin", label: "Inicio", clave: "inicio" },
    { href: "/app/admin/usuarios", label: "Usuarios", clave: "usuarios" },
    { href: "/app/admin/ingresos", label: "Ingresos", clave: "ingresos" },
    { href: "/app/admin/logs", label: "Logs", clave: "logs" },
  ];
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-zinc-200 px-6 py-10 dark:border-white/[0.06] md:block">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // panel admin
        </span>
        <InterruptorTema />
      </div>
      <h2 className="font-display mt-3 text-2xl italic leading-none text-zinc-900 dark:text-white">
        Operador
      </h2>
      <p className="mt-2 truncate font-mono text-[11px] text-zinc-500 dark:text-white/40">
        {emailAdmin}
      </p>

      <nav className="mt-10 flex flex-col gap-1">
        {items.map((it) => (
          <Link
            key={it.clave}
            href={it.href}
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-white/70 dark:hover:border-white/[0.06] dark:hover:bg-white/[0.04] dark:hover:text-white"
          >
            {it.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/app"
        className="mt-10 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/15 dark:text-white/60 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-400/[0.04] dark:hover:text-emerald-300"
      >
        <span>↔</span> Modo cliente
      </Link>
    </aside>
  );
}
