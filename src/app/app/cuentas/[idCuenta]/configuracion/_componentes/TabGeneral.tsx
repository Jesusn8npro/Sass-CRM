"use client";

import { useState } from "react";
import Link from "next/link";
import type { Cuenta, EntradaConocimiento } from "@/lib/baseDatos";
import { WizardChatConfig } from "@/components/WizardChatConfig";
import { SeccionIdentidad } from "./_TabGeneral-identidad";
import { SeccionEstilo, SeccionContexto } from "./_TabGeneral-estilo";

export function BannerConocimiento({ idCuenta, count }: { idCuenta: string; count: number }) {
  return (
    <Link
      href={`/app/cuentas/${idCuenta}/conocimiento`}
      className="group relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-violet-500/30 dark:from-violet-950/40 dark:to-indigo-950/40"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-xl text-white shadow-md">📚</div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">Base de conocimiento</p>
            <h3 className="mt-0.5 text-base font-bold tracking-tight">
              {count > 0 ? `${count} documento${count === 1 ? "" : "s"} cargado${count === 1 ? "" : "s"}` : "Aún no hay documentos cargados"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Subí información (productos, FAQs, políticas) para que tu agente pueda responder con datos reales del negocio.</p>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm group-hover:bg-violet-700 md:inline-flex">Ir a Conocimiento →</span>
      </div>
    </Link>
  );
}

function BannerWizard({ onAbrir }: { onAbrir: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Modo express</p>
          <h3 className="mt-0.5 text-sm font-bold">⚡ Configurá tu agente conversando con la IA</h3>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">Te hace preguntas y va llenando los campos. Después podés ajustar lo que quieras manualmente acá abajo.</p>
        </div>
        <button type="button" onClick={onAbrir} className="shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-400">Abrir chat →</button>
      </div>
    </div>
  );
}

export function TabGeneral({ cuenta, setCuenta, conocimiento }: { cuenta: Cuenta; setCuenta: (c: Cuenta) => void; conocimiento: EntradaConocimiento[] }) {
  const [wizardAbierto, setWizardAbierto] = useState(false);

  async function recargarCuenta() {
    try {
      const r = await fetch(`/api/cuentas/${cuenta.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { cuenta: Cuenta };
      setCuenta(d.cuenta);
    } catch { /* ignorar */ }
  }

  return (
    <>
      <BannerWizard onAbrir={() => setWizardAbierto(true)} />
      <SeccionIdentidad cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionEstilo cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionContexto cuenta={cuenta} onActualizada={setCuenta} />
      <BannerConocimiento idCuenta={cuenta.id} count={conocimiento.length} />
      <WizardChatConfig
        idCuenta={cuenta.id}
        abierto={wizardAbierto}
        onCerrar={() => setWizardAbierto(false)}
        onCompletado={() => { setWizardAbierto(false); void recargarCuenta(); }}
      />
    </>
  );
}
