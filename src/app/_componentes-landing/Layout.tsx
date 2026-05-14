import Link from "next/link";
import { MenuMovil } from "./MenuMovil";

const NAV_LINKS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Operación" },
  { href: "#precios", label: "Precios" },
  { href: "/blog", label: "Blog" },
  { href: "#faq", label: "FAQ" },
];

export function Navegacion() {
  return (
    <nav className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          aria-label="Sass-CRM — Inicio"
          className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Logo />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">
            sass-crm<span className="text-emerald-400">/</span>v2
          </span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-sm font-mono text-[11px] uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="group relative inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-2 text-[12px] font-semibold tracking-tight text-black shadow-[0_0_28px_-4px_rgba(52,211,153,0.6)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_44px_-4px_rgba(52,211,153,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span>Empezar</span>
            <span
              aria-hidden
              className="font-mono text-[10px] opacity-60 transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
          <MenuMovil items={NAV_LINKS} />
        </div>
      </div>
    </nav>
  );
}

export function Logo() {
  return (
    <div
      aria-hidden
      className="relative flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 text-[13px] font-bold text-black"
    >
      S
      <span className="absolute -inset-px rounded-md bg-gradient-to-br from-emerald-400/60 to-teal-500/60 opacity-60 blur-sm" />
    </div>
  );
}

export function PieDePagina() {
  return (
    <footer className="border-t border-white/[0.06] bg-black">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link
            href="/"
            aria-label="Sass-CRM — Inicio"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Logo />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">
              sass-crm
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55">
            Infraestructura de venta para WhatsApp. Construido en LATAM,
            operado en{" "}
            <span className="font-mono text-emerald-400">24×7</span>.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/[0.05] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              uptime 99.97%
            </span>
          </div>
        </div>
        {[
          {
            titulo: "Producto",
            links: [
              { t: "Funciones", h: "#funciones" },
              { t: "Precios", h: "#precios" },
              { t: "Blog", h: "/blog" },
              { t: "FAQ", h: "#faq" },
            ],
          },
          {
            titulo: "Cuenta",
            links: [
              { t: "Crear cuenta", h: "/signup" },
              { t: "Iniciar sesión", h: "/login" },
              { t: "Contacto", h: "/contacto" },
            ],
          },
          {
            titulo: "Legal",
            links: [
              { t: "Términos", h: "/terminos" },
              { t: "Privacidad", h: "/privacidad" },
            ],
          },
        ].map((col) => (
          <div key={col.titulo}>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
              {col.titulo}
            </p>
            <ul className="space-y-2.5 text-sm text-white/65">
              {col.links.map((l) => (
                <li key={l.t}>
                  <Link
                    href={l.h}
                    className="rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {l.t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.04]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/35 sm:flex-row sm:items-center">
          <span>
            © {new Date().getFullYear()} sass-crm — todos los derechos reservados
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
            />
            sistema operativo
          </span>
        </div>
      </div>
    </footer>
  );
}
