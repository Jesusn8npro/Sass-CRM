"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { PLANTILLAS_FUNNEL } from "@/lib/plantillasFunnel-data";

/**
 * Paso 2 — Elegir plantilla por nicho. Cards visuales con descripción.
 * Aplica el funnel + prompt sugerido a la cuenta y avanza.
 * Permite saltar.
 */
export function PasoPlantilla({ idCuenta }: { idCuenta: string }) {
  const router = useRouter();
  const toast = useToast();
  const [aplicando, setAplicando] = useState<string | null>(null);

  async function aplicar(idPlantilla: string) {
    if (aplicando) return;
    setAplicando(idPlantilla);
    try {
      const res = await fetch("/api/onboarding/aplicar-plantilla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idCuenta, idPlantilla }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "No pudimos aplicar la plantilla");
        return;
      }
      toast.exito("Plantilla aplicada");
      await marcarPaso("productos");
      router.replace("/onboarding/productos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setAplicando(null);
    }
  }

  async function saltar() {
    await marcarPaso("productos");
    router.replace("/onboarding/productos");
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400/80">
        02 — Plantilla
      </p>
      <h1 className="font-display mt-2 text-3xl italic leading-tight tracking-tight sm:text-5xl">
        ¿A qué se dedica tu negocio?
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
        Elegí una plantilla y configuramos las etapas del funnel y un
        prompt inicial para tu agente. Después podés ajustarlo todo desde
        el panel.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {PLANTILLAS_FUNNEL.map((p) => {
          const cargando = aplicando === p.id;
          const otro = aplicando !== null && !cargando;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => aplicar(p.id)}
              disabled={otro}
              className="group flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.04] disabled:opacity-40 sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-3xl">{p.icono}</span>
                {cargando && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
                )}
              </div>
              <div>
                <p className="font-display text-xl italic leading-tight text-white">
                  {p.nombre}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {p.descripcion}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                {p.pasos.length} etapas en el funnel
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex justify-end">
        <button
          type="button"
          onClick={saltar}
          disabled={aplicando !== null}
          className="font-mono text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white/80 disabled:opacity-50"
        >
          Saltar este paso →
        </button>
      </div>
    </div>
  );
}

async function marcarPaso(paso: string) {
  try {
    await fetch("/api/onboarding/paso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paso }),
    });
  } catch {
    /* no bloquea */
  }
}
