"use client";
import type { EstadoCita } from "@/lib/baseDatos";

export const COLOR_ESTADO: Record<EstadoCita, string> = {
  agendada: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  confirmada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  realizada: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  cancelada: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  no_asistio: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export const COLOR_BARRA_ESTADO: Record<EstadoCita, string> = {
  agendada: "border-l-amber-400 bg-amber-50/70 dark:bg-amber-950/30",
  confirmada: "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30",
  realizada: "border-l-blue-500 bg-blue-50/70 dark:bg-blue-950/30",
  cancelada: "border-l-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/30",
  no_asistio: "border-l-red-500 bg-red-50/70 dark:bg-red-950/30",
};

export const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  agendada: "Pendiente",
  confirmada: "Confirmada",
  realizada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

export const NOMBRES_DIA = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"] as const;
export const NOMBRES_MES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
] as const;

export function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function inicioDeSemana(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay()); // domingo
  return r;
}

export function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
export function rangoSemana(cursor: Date): string {
  const ini = inicioDeSemana(cursor);
  const fin = new Date(ini);
  fin.setDate(ini.getDate() + 6);
  return `${ini.getDate()} ${NOMBRES_MES[ini.getMonth()].slice(0, 3)} – ${fin.getDate()} ${NOMBRES_MES[fin.getMonth()].slice(0, 3)} ${fin.getFullYear()}`;
}

export type Vista = "lista" | "semana" | "mes";
export type FiltroEstado = "todos" | EstadoCita;

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  accent: "violet" | "emerald" | "amber" | "blue";
}) {
  const ringByAccent: Record<typeof accent, string> = {
    violet: "ring-violet-300/50 dark:ring-violet-500/30 bg-gradient-to-br from-violet-50/70 to-transparent dark:from-violet-950/30",
    emerald: "ring-emerald-300/50 dark:ring-emerald-500/30 bg-gradient-to-br from-emerald-50/70 to-transparent dark:from-emerald-950/30",
    amber: "ring-amber-300/50 dark:ring-amber-500/30 bg-gradient-to-br from-amber-50/70 to-transparent dark:from-amber-950/30",
    blue: "ring-blue-300/50 dark:ring-blue-500/30 bg-gradient-to-br from-blue-50/70 to-transparent dark:from-blue-950/30",
  };
  const iconBg: Record<typeof accent, string> = {
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  };
  return (
    <div className={`rounded-xl bg-white px-4 py-3 ring-1 dark:bg-zinc-900 ${ringByAccent[accent]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${iconBg[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
