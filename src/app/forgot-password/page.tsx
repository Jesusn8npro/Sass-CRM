"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/app/_componentes-landing/Layout";
import { solicitarResetPassword } from "./acciones";

export default function PaginaOlvidePassword() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function manejarSubmit(formData: FormData) {
    setEnviando(true);
    setError(null);
    try {
      const r = await solicitarResetPassword(formData);
      if (r?.error) setError(r.error);
      else setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-zinc-950">
      {/* ── Panel izquierdo: formulario ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <Logo />
          <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-white">
            INYECT<span className="text-emerald-400">AI</span>A
          </span>
        </Link>

        <div className="w-full max-w-sm">
          {enviado ? (
            /* ── Estado: email enviado ── */
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/[0.08]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-6 w-6 text-emerald-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                // email enviado
              </p>
              <h2 className="font-display mt-2 text-2xl italic text-white">
                Revisá tu correo.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Si existe una cuenta con ese email, recibirás un link para
                restablecer tu contraseña en los próximos minutos.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-full border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
              >
                ← Volver al login
              </Link>
            </div>
          ) : (
            /* ── Estado: formulario ── */
            <>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                recuperar acceso
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="mt-1.5 text-sm text-zinc-400">
                Ingresá tu email y te enviamos un link para restablecerla.
              </p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                <form action={manejarSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Email
                    </label>
                    <input
                      name="email"
                      type="email"
                      required
                      autoFocus
                      placeholder="tu@email.com"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={enviando}
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enviando ? "Enviando..." : "Enviar link de recuperación"}
                  </button>
                </form>
              </div>

              <p className="mt-5 text-center text-sm text-zinc-500">
                ¿Recordaste la contraseña?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  Iniciar sesión →
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Panel derecho (solo lg+) ── */}
      <aside
        className="relative hidden w-[46%] overflow-hidden lg:flex lg:flex-col lg:justify-center"
        style={{ background: "linear-gradient(135deg,#18181b 0%,#09090b 100%)" }}
      >
        <div className="absolute inset-y-0 left-0 w-px bg-zinc-800" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle,rgba(52,211,153,0.18) 0%,rgba(52,211,153,0.04) 60%,transparent 80%)",
            animation: "mesh-drift-1 12s ease-in-out infinite",
          }}
        />
        <div className="relative z-10 flex flex-col gap-5 px-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-800/60">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-6 w-6 text-emerald-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
              seguridad primero
            </p>
            <h2 className="font-display mt-2 text-3xl italic leading-snug text-white">
              Tu cuenta
              <br />
              está segura.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              El link de recuperación expira en 60 minutos y solo funciona una
              vez. Si no lo solicitaste vos, podés ignorar el email.
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
