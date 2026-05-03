"use client";

import { useState } from "react";
import { AdminAssistantsVapi } from "@/components/AdminAssistantsVapi";
import { PropsSeccionBase, Tarjeta } from "./compartido";
import { SeccionVapi } from "./SeccionVapi";

export function TabLlamadas({ cuenta, onActualizada }: PropsSeccionBase) {
  const [tabVapi, setTabVapi] = useState<"credenciales" | "assistants">(
    "credenciales",
  );
  return (
    <Tarjeta
      titulo="Llamadas Vapi"
      descripcion="Conexión con Vapi (llamadas automáticas) y administración de assistants."
    >
      <div className="mb-4 inline-flex rounded-full border border-zinc-200 p-0.5 dark:border-zinc-800">
        {(["credenciales", "assistants"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTabVapi(t)}
            className={`rounded-full px-3.5 py-1 text-[11px] font-semibold transition-all ${
              tabVapi === t
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            }`}
          >
            {t === "credenciales" ? "🔑 Credenciales" : "🤖 Assistants"}
          </button>
        ))}
      </div>
      {tabVapi === "credenciales" ? (
        <SeccionVapi cuenta={cuenta} onActualizada={onActualizada} />
      ) : (
        <AdminAssistantsVapi
          idCuenta={cuenta.id}
          vapiPublicKey={cuenta.vapi_public_key}
        />
      )}
    </Tarjeta>
  );
}
