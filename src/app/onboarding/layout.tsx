import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";

/**
 * Layout del wizard de onboarding.
 * - Full-screen, sin sidebar.
 * - Fuerza fondo negro (matchea la landing) independiente del tema.
 * - Barra superior con logo y botón "X cerrar" → /app.
 *
 * Requiere sesión: si no hay usuario, redirige a /login con destino.
 */
export default async function LayoutOnboarding({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/onboarding");

  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      {/* Barra superior — logo + cerrar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-6">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-white"
          >
            <span className="font-display italic text-emerald-400">Agente</span>
            <span className="text-white/80"> WhatsApp</span>
          </Link>
          <Link
            href="/app"
            aria-label="Cerrar onboarding"
            title="Salir del onboarding"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-white/30 hover:bg-white/[0.04] hover:text-white"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1L13 13M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      {children}
    </main>
  );
}
