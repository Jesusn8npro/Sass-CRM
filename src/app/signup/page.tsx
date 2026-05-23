import Link from "next/link";
import { Logo } from "@/app/_componentes-landing/Layout";
import { FormularioSignup } from "./formulario";

const METRICAS = [
  { valor: "2 min", label: "Setup inicial" },
  { valor: "< 5s", label: "Respuesta IA" },
  { valor: "3.800+", label: "Negocios activos" },
];

export default function PaginaSignup() {
  return (
    <main className="flex min-h-screen bg-zinc-950">
      {/* ── Panel izquierdo: formulario ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <Link href="/" className="mb-10 flex items-center gap-2.5">
          <Logo />
          <span className="font-mono text-[12px] uppercase tracking-[0.15em] text-white">
            INYECT<span className="text-emerald-400">AI</span>A
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            gratis para siempre
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Comenzá hoy gratis
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Setup en 2 minutos. Sin tarjeta de crédito.
          </p>

          {/* Form card */}
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <FormularioSignup />
          </div>

          {/* Hint */}
          <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600">
            sin tarjeta de crédito · cancelá cuando quieras
          </p>

          {/* Link alternativo */}
          <p className="mt-5 text-center text-sm text-zinc-500">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Iniciá sesión →
            </Link>
          </p>

          {/* Legal */}
          <p className="mt-4 text-center text-[10px] text-zinc-600">
            Al crear cuenta aceptás nuestros{" "}
            <Link href="/terminos" className="underline hover:text-zinc-400">
              términos
            </Link>{" "}
            y{" "}
            <Link href="/privacidad" className="underline hover:text-zinc-400">
              política de privacidad
            </Link>
            .
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
            Joyería Acosta · Buenos Aires
          </p>
          <blockquote className="mt-3 text-sm leading-relaxed text-zinc-300">
            "Lo enchufé un viernes, el sábado ya estaba vendiendo. El cliente
            ni se entera que es una IA — responde con el mismo tono que yo."
          </blockquote>
          <p className="mt-4 text-xs text-zinc-500">— Martín Acosta, fundador</p>
        </div>
      </aside>
    </main>
  );
}
