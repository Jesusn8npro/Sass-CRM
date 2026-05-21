"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePollingVisible } from "@/components/usePollingVisible";

interface CorreoLog {
  id: string;
  lead_id: string;
  resend_message_id: string | null;
  paso: 1 | 2 | 3;
  estado_envio: string;
  programado_para: string | null;
  enviado_en: string | null;
  creado_en: string;
  leads_extraidos?: { nombre: string; email: string | null; categoria: string | null };
}

const ETIQUETA_PASO: Record<number, string> = {
  1: "Paso 1 — Inicial",
  2: "Paso 2 — Seguimiento (día 3)",
  3: "Paso 3 — Último mensaje (día 7)",
};

const COLOR_ESTADO: Record<string, string> = {
  pendiente: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  enviado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  entregado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rebotado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  spam: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  fallido: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  entregado: "Entregado",
  rebotado: "Rebotado",
  spam: "Marcado spam",
  fallido: "Fallido",
};

function formatearFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function PaginaCorreosProspeccion() {
  const params = useParams();
  const idCuenta = params.idCuenta as string;

  const [correos, setCorreos] = useState<CorreoLog[]>([]);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/correos`);
    if (r.ok) {
      const d = await r.json() as { correos: CorreoLog[] };
      setCorreos(d.correos);
    }
  }, [idCuenta]);

  usePollingVisible(cargar, 40_000);

  // Agrupar por lead
  const porLead = correos.reduce<Record<string, CorreoLog[]>>((acc, c) => {
    (acc[c.lead_id] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href={`/app/cuentas/${idCuenta}/prospeccion`}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Volver al pipeline
          </Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Correos de prospección
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Secuencia automática de 3 correos por lead sin teléfono.
          </p>
        </div>

        {correos.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-4xl mb-3">✉️</p>
            <p className="text-sm text-zinc-400">No hay correos registrados aún.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(porLead).map(([leadId, registros]) => {
              const nombre = registros[0]?.leads_extraidos?.nombre ?? "Lead";
              const email = registros[0]?.leads_extraidos?.email ?? "";
              registros.sort((a, b) => a.paso - b.paso);
              return (
                <div
                  key={leadId}
                  className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{nombre}</p>
                    <p className="text-xs text-zinc-400">{email}</p>
                  </div>
                  <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {registros.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            {ETIQUETA_PASO[c.paso] ?? `Paso ${c.paso}`}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {c.estado_envio === "pendiente"
                              ? `Programado: ${formatearFecha(c.programado_para)}`
                              : `Enviado: ${formatearFecha(c.enviado_en)}`}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_ESTADO[c.estado_envio] ?? ""}`}>
                          {ETIQUETA_ESTADO[c.estado_envio] ?? c.estado_envio}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
