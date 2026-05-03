"use client";

export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatearDia(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit" });
}

export function Kpi({
  titulo,
  valor,
  detalle,
  acento,
}: {
  titulo: string;
  valor: number | string;
  detalle?: string;
  acento?: "rojo" | "esmeralda" | "ambar";
}) {
  const colorValor =
    acento === "rojo"
      ? "text-red-600 dark:text-red-400"
      : acento === "esmeralda"
      ? "text-emerald-600 dark:text-emerald-400"
      : acento === "ambar"
      ? "text-amber-600 dark:text-amber-400"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {titulo}
      </p>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${colorValor}`}>
        {valor}
      </p>
      {detalle && (
        <p className="mt-1 text-[11px] text-zinc-500">{detalle}</p>
      )}
    </div>
  );
}
