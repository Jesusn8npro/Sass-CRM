"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePollingVisible } from "@/components/usePollingVisible";

interface StatsProspeccion {
  conteos: Record<string, number>;
  total: number;
  contactados: number;
  llamadas_ultima_hora: number;
  limite_hora: number;
  modo_prueba: boolean;
}

export function SeccionProspeccion({ idCuenta }: { idCuenta: string }) {
  const [stats, setStats] = useState<StatsProspeccion | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/stats`, {
      cache: "no-store",
    });
    if (r.ok) setStats(await r.json() as StatsProspeccion);
  }, [idCuenta]);

  usePollingVisible(cargar, 30_000);

  if (!stats || stats.total === 0) return null;

  const porContactar = (stats.conteos.nuevo ?? 0) + (stats.conteos.en_cola ?? 0);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            🎯 Prospección Automática
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Pipeline de contacto a leads de Google Maps
          </p>
        </div>
        <Link
          href={`/app/cuentas/${idCuenta}/prospeccion`}
          className="text-xs text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Ver pipeline completo →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Total leads
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
            Por contactar
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
            {porContactar}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
            Contactados
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {stats.contactados}
          </p>
        </div>
        <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-900/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
            Completados
          </p>
          <p className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-300">
            {stats.conteos.completado ?? 0}
          </p>
        </div>
      </div>

      {stats.modo_prueba && (
        <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
          ⚠️ Modo prueba activo — las llamadas van a tu número de prueba.
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <Link
          href={`/app/cuentas/${idCuenta}/prospeccion/llamadas`}
          className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          📞 Ver llamadas ({(stats.conteos.llamado ?? 0) + (stats.conteos.completado ?? 0)})
        </Link>
        <span className="text-zinc-200 dark:text-zinc-700">|</span>
        <Link
          href={`/app/cuentas/${idCuenta}/prospeccion/correos`}
          className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ✉️ Ver correos ({stats.conteos.emaileado ?? 0})
        </Link>
        <span className="text-zinc-200 dark:text-zinc-700">|</span>
        <Link
          href={`/app/cuentas/${idCuenta}/leads`}
          className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          🔍 Buscar más leads
        </Link>
      </div>
    </section>
  );
}
