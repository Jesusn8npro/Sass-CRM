"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ConvMin {
  id: string;
  ultimo_mensaje_en: string | null;
}

/**
 * Paso 4 — Probar el agente. Polea /api/cuentas/{id}/conversaciones
 * cada 4s y muestra "✓ recibimos tu primer mensaje" cuando aparece
 * la primera conversación con mensaje. Permite saltar al panel.
 */
export function PasoProbar({ idCuenta }: { idCuenta: string }) {
  const router = useRouter();
  const [recibido, setRecibido] = useState(false);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    let detenido = false;
    async function consultar() {
      try {
        const res = await fetch(
          `/api/cuentas/${idCuenta}/conversaciones`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { conversaciones: ConvMin[] };
        const algunoConMensaje = (data.conversaciones ?? []).some(
          (c) => !!c.ultimo_mensaje_en,
        );
        if (!detenido && algunoConMensaje) setRecibido(true);
      } catch {
        /* silencio */
      }
    }
    void consultar();
    const t = setInterval(consultar, 4000);
    return () => {
      detenido = true;
      clearInterval(t);
    };
  }, [idCuenta]);

  async function ir(idCuentaDestino: string) {
    if (finalizando) return;
    setFinalizando(true);
    try {
      await fetch("/api/onboarding/paso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completo: true }),
      });
    } catch {
      /* no bloquea */
    }
    router.replace(`/app/cuentas/${idCuentaDestino}/conversaciones`);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400/80">
        04 — Probar
      </p>
      <h1 className="font-display mt-2 text-3xl italic leading-tight tracking-tight sm:text-5xl">
        Probá tu agente
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
        Mandá un mensaje a tu propio número de WhatsApp desde otro
        celular y mirá cómo responde la IA. Cuando llegue el primer
        mensaje, te avisamos acá.
      </p>

      <div
        className={`mt-10 rounded-2xl border p-6 transition-colors sm:p-8 ${
          recibido
            ? "border-emerald-400/40 bg-emerald-400/[0.06]"
            : "border-white/[0.06] bg-white/[0.02]"
        }`}
      >
        {recibido ? (
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 font-bold text-black">
              ✓
            </span>
            <div>
              <p className="font-display text-2xl italic text-emerald-300">
                Recibimos tu primer mensaje
              </p>
              <p className="mt-2 text-sm text-white/70">
                Tu agente ya está respondiendo. Andá al panel y mirá la
                conversación.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <span className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
            <div>
              <p className="font-display text-xl italic text-white/90">
                Esperando el primer mensaje…
              </p>
              <ul className="mt-3 space-y-2 text-sm text-white/60">
                <li>
                  <span className="font-mono text-emerald-400">1.</span>{" "}
                  Tomá otro celular (no el que tiene la cuenta).
                </li>
                <li>
                  <span className="font-mono text-emerald-400">2.</span>{" "}
                  Mandá un mensaje al número que conectaste.
                </li>
                <li>
                  <span className="font-mono text-emerald-400">3.</span>{" "}
                  Esperá unos segundos y mirá la respuesta automática.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => ir(idCuenta)}
          disabled={finalizando}
          className="font-mono text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white/80 disabled:opacity-50"
        >
          Saltar este paso →
        </button>
        <button
          type="button"
          onClick={() => ir(idCuenta)}
          disabled={finalizando}
          className="rounded-full bg-emerald-400 px-6 py-3.5 text-base font-semibold text-black shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-300 disabled:opacity-50"
        >
          {finalizando ? "Yendo…" : "Listo, ir al panel"}
        </button>
      </div>
    </div>
  );
}
