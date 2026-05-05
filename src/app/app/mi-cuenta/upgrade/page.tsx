"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PayPalCheckout, PayPalProvider } from "@/components/PayPalCheckout";

const PLANES = [
  {
    id: "free" as const,
    nombre: "Gratis",
    precio: 0,
    descripcion: "Para validar el sistema con un número.",
    items: ["1 cuenta WhatsApp", "100 conversaciones/mes", "GPT-4o-mini", "Soporte por chat"],
  },
  {
    id: "pro" as const,
    nombre: "Pro",
    precio: 29,
    descripcion: "Para emprendedores que ya venden por WhatsApp.",
    items: [
      "WhatsApp ilimitados",
      "Conversaciones ilimitadas",
      "1.000 créditos/mes incluidos",
      "Voz clonada + Vapi",
      "Multi-modelo (GPT-4o · Claude)",
      "Soporte prioritario",
    ],
    destacado: true,
  },
  {
    id: "business" as const,
    nombre: "Business",
    precio: 199,
    descripcion: "Agencias y SaaS que revenden a sus clientes.",
    items: [
      "Todo lo de Pro",
      "10.000 créditos/mes",
      "Dominio propio + branding",
      "API completa",
      "Onboarding dedicado",
      "SLA 99.9%",
    ],
  },
];

export default function PaginaUpgrade() {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/app/mi-cuenta"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 hover:text-white"
        >
          ← volver
        </Link>

        <div className="mt-8 max-w-2xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
            // upgrade
          </p>
          <h1 className="text-4xl tracking-[-0.02em] md:text-5xl">
            Elegí tu <span className="font-display italic text-white/70">plan</span>.
          </h1>
          <p className="mt-4 text-white/55">
            Suscripción mensual. Cancelás cuando quieras desde tu cuenta — el pago se hace
            seguro a través de PayPal sin salir de la plataforma.
          </p>
        </div>

        {mensaje && (
          <div
            className={`mt-8 rounded-lg border px-4 py-3 text-sm ${
              mensaje.tipo === "ok"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <PayPalProvider modo="suscripcion">
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANES.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.destacado
                  ? "border-emerald-400/40 bg-gradient-to-b from-emerald-400/[0.04] to-transparent shadow-[0_0_60px_-20px_rgba(52,211,153,0.5)]"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              {plan.destacado && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-400/40 bg-black px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300">
                  más popular
                </div>
              )}
              <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">{plan.nombre}</h3>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-6xl tracking-tight">${plan.precio}</span>
                <span className="font-mono text-[11px] tracking-wide text-white/40">/mes</span>
              </div>
              <p className="mt-3 text-sm text-white/55">{plan.descripcion}</p>
              <ul className="mt-7 flex-1 space-y-2.5">
                {plan.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[13px] text-white/75">
                    <span className="mt-[7px] h-px w-3 shrink-0 bg-emerald-400" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 min-h-[60px]">
                {plan.id === "free" ? (
                  <button
                    onClick={() => router.push("/app")}
                    className="block w-full rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/85 hover:border-white/40"
                  >
                    Sigo en gratis
                  </button>
                ) : (
                  <PayPalCheckout
                    modo="suscripcion"
                    identificador={plan.id}
                    onExito={(r) => {
                      setMensaje({ tipo: "ok", texto: r.mensaje + " Te redirijo a tu cuenta..." });
                      setTimeout(() => router.push("/app/mi-cuenta"), 2000);
                    }}
                    onError={(m) => setMensaje({ tipo: "error", texto: m })}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
        </PayPalProvider>

        <p className="mt-10 max-w-3xl font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
          pago seguro vía paypal · cancelás cuando quieras · sin cargos ocultos
        </p>
      </div>
    </main>
  );
}
