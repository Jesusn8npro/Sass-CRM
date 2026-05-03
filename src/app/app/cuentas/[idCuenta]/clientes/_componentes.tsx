"use client";

import Link from "next/link";
import type {
  ConversacionConPreview,
  EstadoLead,
} from "@/lib/baseDatos";

export type FiltroEstado = "todos" | EstadoLead;

export interface FilaCliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  telefonoExtra: string | null;
  modo: "IA" | "HUMANO";
  necesitaHumano: boolean;
  etiquetas: { id: string; nombre: string; color: string }[];
  ultimoMensaje: string | null;
  preview: string | null;
  leadScore: number;
  estadoLead: EstadoLead;
  pasoActual: string;
  datosCapturados: ConversacionConPreview["datos_capturados"];
}

export const ESTADOS: { id: FiltroEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nuevo", label: "Nuevo" },
  { id: "contactado", label: "Contactado" },
  { id: "calificado", label: "Calificado" },
  { id: "interesado", label: "Interesado" },
  { id: "negociacion", label: "Negociación" },
  { id: "cerrado", label: "Cerrado" },
  { id: "perdido", label: "Perdido" },
];

export const COLOR_ESTADO: Record<EstadoLead, string> = {
  nuevo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  contactado: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  calificado: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  interesado: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  negociacion: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  cerrado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export const LABEL_ESTADO: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  interesado: "Interesado",
  negociacion: "Negociación",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  icon: string;
  accent: "zinc" | "violet" | "amber" | "emerald" | "red";
}) {
  const ringByAccent: Record<typeof accent, string> = {
    zinc: "ring-zinc-200 dark:ring-zinc-800",
    violet: "ring-violet-300/50 dark:ring-violet-500/30 bg-gradient-to-br from-violet-50 to-transparent dark:from-violet-950/30",
    amber: "ring-amber-300/50 dark:ring-amber-500/30 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/30",
    emerald: "ring-emerald-300/50 dark:ring-emerald-500/30 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/30",
    red: "ring-red-300/50 dark:ring-red-500/30 bg-gradient-to-br from-red-50 to-transparent dark:from-red-950/30",
  };
  const iconBg: Record<typeof accent, string> = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };
  return (
    <div className={`rounded-xl bg-white px-4 py-3 ring-1 backdrop-blur dark:bg-zinc-900 ${ringByAccent[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">
            {value.toLocaleString("es-AR")}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${iconBg[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function BarraScore({ valor }: { valor: number }) {
  const v = Math.max(0, Math.min(100, valor));
  const color =
    v < 20
      ? "bg-zinc-300 dark:bg-zinc-700"
      : v < 40
      ? "bg-blue-400"
      : v < 60
      ? "bg-amber-400"
      : v < 80
      ? "bg-orange-500"
      : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
        {v}%
      </span>
    </div>
  );
}

export function ModalDetalle({
  cliente,
  onCerrar,
  idCuenta,
}: {
  cliente: FilaCliente;
  onCerrar: () => void;
  idCuenta: string;
}) {
  const dc = cliente.datosCapturados ?? {};
  const otros = dc.otros && Object.keys(dc.otros).length > 0 ? dc.otros : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-base font-bold text-white shadow-md">
              {cliente.nombre.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {cliente.nombre}
              </h2>
              <p className="font-mono text-xs text-zinc-500">
                {cliente.telefono}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        {/* Estado + Score */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Estado
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${COLOR_ESTADO[cliente.estadoLead]}`}
            >
              {LABEL_ESTADO[cliente.estadoLead]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pt-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:from-violet-950/40 dark:to-indigo-950/40">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
              Lead Score
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-tight">
              {cliente.leadScore}%
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/40 dark:to-teal-950/40">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Paso Actual
            </p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">
              {cliente.pasoActual}
            </p>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="px-6 pt-5">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Información de contacto
          </h3>
          <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            {cliente.email ? (
              <p className="flex items-center gap-2 text-sm">
                <span className="text-emerald-500">✉</span>
                <span className="font-mono">{cliente.email}</span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <span>✉</span>
                <span>Email no capturado todavía</span>
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <span className="text-emerald-500">☎</span>
              <span className="font-mono">{cliente.telefono}</span>
            </p>
            {cliente.telefonoExtra && (
              <p className="flex items-center gap-2 text-sm">
                <span className="text-emerald-500">☎</span>
                <span className="font-mono">{cliente.telefonoExtra}</span>
                <span className="text-[10px] text-zinc-500">(alt)</span>
              </p>
            )}
          </div>
        </div>

        {/* Datos del negocio / lead profile */}
        {(dc.negocio || dc.interes || dc.ventajas || dc.miedos || otros) && (
          <div className="px-6 pt-5">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Perfil del lead (capturado por IA)
            </h3>
            <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              {dc.negocio && (
                <CampoLead label="Negocio" valor={dc.negocio} />
              )}
              {dc.interes && (
                <CampoLead label="Interés" valor={dc.interes} />
              )}
              {dc.ventajas && (
                <CampoLead label="Ventajas que valora" valor={dc.ventajas} />
              )}
              {dc.miedos && (
                <CampoLead label="Miedos / objeciones" valor={dc.miedos} />
              )}
              {otros &&
                Object.entries(otros).map(([k, v]) => (
                  <CampoLead key={k} label={k} valor={v} />
                ))}
            </div>
          </div>
        )}

        {/* Estado del bot */}
        <div className="px-6 pt-5">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Estado del Bot
          </h3>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="text-sm font-semibold">
              {cliente.necesitaHumano || cliente.modo === "HUMANO"
                ? "Atendido por humano"
                : "Bot activo"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {cliente.necesitaHumano
                ? "El cliente necesita atención humana"
                : cliente.modo === "HUMANO"
                ? "Modo humano activo manualmente"
                : "Sin intervención humana"}
            </p>
          </div>
        </div>

        {/* Etiquetas */}
        {cliente.etiquetas.length > 0 && (
          <div className="px-6 pt-5">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {cliente.etiquetas.map((et) => (
                <span
                  key={et.id}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-800"
                >
                  {et.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer con CTA */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Cerrar
          </button>
          <Link
            href={`/app/cuentas/${idCuenta}/conversaciones?conv=${cliente.id}`}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Abrir conversación →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CampoLead({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="text-sm">{valor}</p>
    </div>
  );
}
