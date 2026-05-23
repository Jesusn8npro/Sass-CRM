import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/app/_componentes-landing/Layout";
import { FormularioResetPassword } from "./formulario";

export default function PaginaResetPassword() {
  return (
    <main className="flex min-h-screen bg-zinc-950">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <Logo />
          <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-white">
            INYECT<span className="text-emerald-400">AI</span>A
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            nueva contraseña
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Restablecer contraseña
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Elegí una contraseña nueva y segura para tu cuenta.
          </p>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <Suspense fallback={null}>
              <FormularioResetPassword />
            </Suspense>
          </div>

          <p className="mt-5 text-center text-sm text-zinc-500">
            ¿El link expiró?{" "}
            <Link
              href="/forgot-password"
              className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Solicitar uno nuevo →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
