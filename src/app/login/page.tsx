import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/app/_componentes-landing/Layout";
import { FormularioLogin } from "./formulario";

const METRICAS = [
  { valor: "100%", label: "Tasa de respuesta" },
  { valor: "< 4s", label: "Latencia IA" },
  { valor: "+1.200", label: "Mensajes / día" },
];

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen bg-zinc-950">
      {/* ── Panel izquierdo: formulario ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <Logo />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
            sass-crm<span className="text-emerald-400">/</span>v2
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            acceso seguro
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bienvenido de vuelta
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Ingresá con tu email para continuar.
          </p>

          {/* Form card */}
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <Suspense fallback={null}>
              <FormularioLogin />
            </Suspense>
          </div>

          {/* Hint */}
          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600">
            sin tarjeta de crédito
          </p>

          {/* Link alternativo */}
          <p className="mt-5 text-center text-sm text-zinc-500">
            ¿No tenés cuenta?{" "}
            <Link
              href="/signup"
              className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Crear cuenta gratis →
            </Link>
          </p>
        </div>
      </div>

      {/* ── Panel derecho: info (solo lg+) ── */}
      <aside
        className="relative hidden w-[46%] overflow-hidden lg:flex lg:flex-col lg:justify-between"
        style={{ background: "linear-gradient(135deg, #18181b 0%, #09090b 100%)" }}
      >
        {/* Borde izquierdo sutil */}
        <div className="absolute inset-y-0 left-0 w-px bg-zinc-800" />

        {/* Orb animado */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.04) 60%, transparent 80%)",
            animation: "mesh-drift-1 12s ease-in-out infinite",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-[340px] w-[340px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)",
            animation: "mesh-drift-2 16s ease-in-out infinite",
          }}
        />

        {/* Contenido */}
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-6 px-12">
          {/* Métricas flotantes */}
          {METRICAS.map((m, i) => (
            <div
              key={m.label}
              className="w-fit rounded-xl border border-zinc-700/60 bg-zinc-900/80 px-5 py-3.5 shadow-xl backdrop-blur-sm"
              style={{
                animation: `float-card ${4 + i * 0.8}s ease-in-out infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            >
              <p className="text-xl font-bold text-white">{m.valor}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {m.label}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="relative z-10 m-10 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 backdrop-blur-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Inmobiliaria Del Sur
          </p>
          <blockquote className="mt-3 text-sm leading-relaxed text-zinc-300">
            "Pasamos de perder leads a cerrar el 80% de las consultas de WhatsApp.
            El bot trabaja mientras dormimos."
          </blockquote>
          <p className="mt-4 text-xs text-zinc-500">— Daniela R., directora comercial</p>
        </div>
      </aside>
    </main>
  );
}
