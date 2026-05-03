import Link from "next/link";

export function Navegacion() {
  return (
    <nav className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">Sass-CRM</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-medium text-zinc-600 md:flex dark:text-zinc-400">
          <a href="#funciones" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            Funciones
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            Cómo funciona
          </a>
          <a href="#precios" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            Precios
          </a>
          <a href="#faq" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
            FAQ
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/40"
          >
            Empezar gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md shadow-emerald-500/20">
      S
    </div>
  );
}

export function PieDePagina() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50/50 py-12 dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-base font-bold">Sass-CRM</span>
            </Link>
            <p className="mt-3 text-xs text-zinc-500">
              Tu agente de WhatsApp con IA. Hecho en LATAM 🌎
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Producto
            </p>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><a href="#funciones" className="hover:text-zinc-900 dark:hover:text-zinc-100">Funciones</a></li>
              <li><a href="#precios" className="hover:text-zinc-900 dark:hover:text-zinc-100">Precios</a></li>
              <li><a href="#faq" className="hover:text-zinc-900 dark:hover:text-zinc-100">Preguntas frecuentes</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cuenta
            </p>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><Link href="/signup" className="hover:text-zinc-900 dark:hover:text-zinc-100">Crear cuenta</Link></li>
              <li><Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100">Iniciar sesión</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Legal
            </p>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li><span className="text-zinc-400">Términos (próximo)</span></li>
              <li><span className="text-zinc-400">Privacidad (próximo)</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
          © {new Date().getFullYear()} Sass-CRM. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
