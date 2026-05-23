"use client";

import Link from "next/link";
import { useState } from "react";
import { Navegacion, PieDePagina } from "../_componentes-landing/Layout";

const CANALES = [
  {
    icono: "◈",
    titulo: "WhatsApp directo",
    desc: "Escribinos y un humano del equipo responde en menos de 2 horas en horario hábil.",
    cta: "Abrir WhatsApp",
    href: "https://wa.me/message/INYECTAIA",
    color: "emerald",
  },
  {
    icono: "◉",
    titulo: "Email",
    desc: "Para consultas detalladas, presupuestos o propuestas de integración.",
    cta: "hola@inyectaia.com",
    href: "mailto:hola@inyectaia.com",
    color: "teal",
  },
  {
    icono: "⬡",
    titulo: "Demo personalizada",
    desc: "Te mostramos INYECTAIA funcionando con datos de tu industria. 30 minutos sin compromiso.",
    cta: "Agendar demo",
    href: "/demo",
    color: "violet",
  },
];

const TEMAS = [
  "Quiero probar INYECTAIA",
  "Necesito una demo personalizada",
  "Tengo dudas sobre precios",
  "Soy una agencia / quiero white-label",
  "Tengo una consulta técnica",
  "Otro",
];

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  emerald: {
    border: "border-emerald-400/20 hover:border-emerald-400/50",
    bg: "bg-emerald-400/[0.04] hover:bg-emerald-400/[0.08]",
    text: "text-emerald-300",
    icon: "text-emerald-400/60 group-hover:text-emerald-300",
  },
  teal: {
    border: "border-teal-400/20 hover:border-teal-400/50",
    bg: "bg-teal-400/[0.04] hover:bg-teal-400/[0.08]",
    text: "text-teal-300",
    icon: "text-teal-400/60 group-hover:text-teal-300",
  },
  violet: {
    border: "border-violet-400/20 hover:border-violet-400/50",
    bg: "bg-violet-400/[0.04] hover:bg-violet-400/[0.08]",
    text: "text-violet-300",
    icon: "text-violet-400/60 group-hover:text-violet-300",
  },
};

export default function PaginaContacto() {
  const [tema, setTema] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !email || !mensaje) return;
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 900));
    setEnviando(false);
    setEnviado(true);
  }

  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(16,185,129,0.18),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
          <p className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            // hablemos
          </p>
          <h1 className="mx-auto max-w-2xl text-[44px] leading-[1.02] tracking-[-0.03em] text-white md:text-[72px] md:leading-[0.96]">
            ¿Cómo podemos{" "}
            <span className="font-display italic text-emerald-300">ayudarte</span>?
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/55">
            Somos un equipo pequeño que responde de verdad. Sin bots, sin tickets, sin esperar 3 días hábiles.
          </p>
        </div>
      </section>

      {/* Canales de contacto */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {CANALES.map((c) => {
            const col = COLOR_MAP[c.color];
            return (
              <Link
                key={c.titulo}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`group flex flex-col gap-4 rounded-2xl border p-7 transition-all ${col.border} ${col.bg} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
              >
                <div className="flex items-start justify-between">
                  <span className={`font-mono text-3xl transition-colors ${col.icon}`}>{c.icono}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25 transition-colors group-hover:text-white/50">
                    →
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">{c.titulo}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/50">{c.desc}</p>
                </div>
                <span className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${col.text}`}>
                  {c.cta}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Formulario */}
      <section className="mx-auto max-w-6xl px-6 pb-24 md:pb-32">
        <div className="grid gap-16 md:grid-cols-[1fr_1.4fr]">
          {/* Info lateral */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // formulario
            </p>
            <h2 className="text-3xl tracking-[-0.025em] text-white md:text-4xl">
              Contanos qué{" "}
              <span className="font-display italic text-white/60">necesitás</span>.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/55">
              Completá el formulario y el equipo te responde en menos de 24 horas. Si es urgente, escribinos por WhatsApp.
            </p>

            <div className="mt-10 space-y-5 border-t border-white/[0.06] pt-8">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-xs text-emerald-400">01</span>
                <div>
                  <p className="text-sm font-medium text-white">Respondemos rápido</p>
                  <p className="text-sm text-white/45">Menos de 24 hs en días hábiles. Menos de 2 hs por WhatsApp.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-xs text-emerald-400">02</span>
                <div>
                  <p className="text-sm font-medium text-white">Sin pitch de ventas</p>
                  <p className="text-sm text-white/45">Primero entendemos tu negocio. Después, si tiene sentido, te mostramos cómo INYECTAIA puede ayudarte.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-xs text-emerald-400">03</span>
                <div>
                  <p className="text-sm font-medium text-white">Confidencial</p>
                  <p className="text-sm text-white/45">Tu información no se comparte con terceros. Jamás.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="relative">
            {enviado ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                  <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-emerald-400" aria-hidden>
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-medium text-white">¡Mensaje enviado!</p>
                  <p className="mt-2 text-sm text-white/55">
                    Te respondemos en menos de 24 horas. Si es urgente, escribinos por{" "}
                    <Link href="https://wa.me/message/INYECTAIA" target="_blank" className="text-emerald-300 hover:underline">
                      WhatsApp
                    </Link>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEnviado(false); setNombre(""); setEmail(""); setMensaje(""); setTema(""); }}
                  className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white"
                >
                  Enviar otro mensaje
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8"
              >
                {/* Tema */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Tema
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TEMAS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTema(t)}
                        className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-all ${
                          tema === t
                            ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                            : "border-white/10 bg-white/[0.02] text-white/40 hover:border-white/25 hover:text-white/70"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="nombre" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Nombre
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    required
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-emerald-400/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-emerald-400/20"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-emerald-400/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-emerald-400/20"
                  />
                </div>

                {/* Mensaje */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="mensaje" className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Mensaje
                  </label>
                  <textarea
                    id="mensaje"
                    required
                    rows={4}
                    placeholder="Contanos sobre tu negocio y qué necesitás..."
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    className="resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-emerald-400/40 focus:bg-white/[0.05] focus:ring-1 focus:ring-emerald-400/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviando || !nombre || !email || !mensaje}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_28px_-4px_rgba(52,211,153,0.6)] transition-all hover:bg-emerald-300 hover:shadow-[0_0_44px_-4px_rgba(52,211,153,0.9)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar mensaje
                      <span aria-hidden className="font-mono text-xs opacity-60 transition-transform group-hover:translate-x-0.5">→</span>
                    </>
                  )}
                </button>

                <p className="text-center font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
                  Respondemos en menos de 24 horas · sin spam
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <PieDePagina />
    </main>
  );
}
