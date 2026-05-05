import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  adminPanelHabilitado,
  esEmailAdmin,
  obtenerUsuarioActual,
} from "@/lib/auth/sesion";

/**
 * Layout del panel de administración. Sólo accesible para los emails
 * declarados en `ADMIN_EMAIL` (env). Si la variable no está configurada,
 * el panel entero devuelve 404 — es un kill switch global.
 *
 *  - Sin sesión → /login
 *  - Logueado pero email != admin → /app
 */
export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!adminPanelHabilitado()) {
    notFound();
  }

  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app/admin");
  if (!esEmailAdmin(auth.email)) redirect("/app");

  return (
    <div className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
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
  ];
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-white/[0.06] px-6 py-10 md:block">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
        // panel admin
      </div>
      <h2 className="font-display mt-3 text-2xl italic leading-none text-white">
        Operador
      </h2>
      <p className="mt-2 truncate font-mono text-[11px] text-white/40">
        {emailAdmin}
      </p>

      <nav className="mt-10 flex flex-col gap-1">
        {items.map((it) => (
          <Link
            key={it.clave}
            href={it.href}
            className="rounded-lg border border-transparent px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
          >
            {it.label}
          </Link>
        ))}
      </nav>

      <Link
        href="/app"
        className="mt-10 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40 hover:text-white/80"
      >
        <span>←</span> Volver al panel
      </Link>
    </aside>
  );
}
