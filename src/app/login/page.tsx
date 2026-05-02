import { Suspense } from "react";
import Link from "next/link";
import { FormularioLogin } from "./formulario";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-emerald-50 px-4 dark:from-zinc-950 dark:to-emerald-950/20">
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
            Entrar a tu cuenta
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Bienvenido de vuelta. Ingresá con tu email.
          </p>

          <Suspense fallback={null}>
            <FormularioLogin />
          </Suspense>

          <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            ¿No tenés cuenta?{" "}
            <Link
              href="/signup"
              className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Crear cuenta gratis
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
