"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { InteresadoEnProducto, Producto } from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaInteresados {
  producto: Producto;
  interesados: InteresadoEnProducto[];
}

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function PaginaInteresados() {
  const params = useParams<{ idCuenta: string; idProducto: string }>();
  const idCuenta = params?.idCuenta ?? "";
  const idProducto = params?.idProducto ?? "";

  const [data, setData] = useState<RespuestaInteresados | null>(null);

  const cargar = useCallback(async () => {
    if (!idCuenta || !idProducto) return;
    const res = await fetch(
      `/api/cuentas/${idCuenta}/productos/${idProducto}/clientes-interesados`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const d = (await res.json()) as RespuestaInteresados;
      setData(d);
    }
  }, [idCuenta, idProducto]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/app/cuentas/${idCuenta}/productos`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Interesados
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {data?.producto.nombre ?? "—"}
              </h1>
            </div>
          </div>
          <InterruptorTema />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {!data ? (
          <p className="text-sm text-zinc-500">Cargando...</p>
        ) : data.interesados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aún no hay interesados
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Cuando un cliente pregunte por este producto en una conversación,
              el agente lo registrará y aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                {data.interesados.length} cliente
                {data.interesados.length === 1 ? "" : "s"} preguntaron por{" "}
                <strong>{data.producto.nombre}</strong>
              </p>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.interesados.map((i) => (
                <li
                  key={i.conversacion_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {i.nombre_contacto ?? `+${i.telefono}`}
                    </p>
                    <p className="truncate font-mono text-[11px] text-zinc-500">
                      +{i.telefono}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i.necesita_humano && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700 dark:bg-red-500/20 dark:text-red-300">
                        Atención
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-500">
                      {i.veces}× · hace {tiempoRelativo(i.ultimo_interes_en)}
                    </span>
                    <Link
                      href={`/app/cuentas/${idCuenta}/contactos/${i.conversacion_id}`}
                      className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      Ver perfil →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
