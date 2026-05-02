import Link from "next/link";
import { FormularioSignup } from "./formulario";

export default function PaginaSignup() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-emerald-50 px-4 py-8 dark:from-zinc-950 dark:to-emerald-950/20">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-base font-bold text-white">
            S
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Sass-CRM
          </span>
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Crear tu cuenta
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Setup en 2 minutos. Sin tarjeta de crédito.
          </p>

          <FormularioSignup />

          <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-zinc-500">
          Al crear cuenta aceptás nuestros términos y política de privacidad.
        </p>
      </div>
    </main>
  );
}
