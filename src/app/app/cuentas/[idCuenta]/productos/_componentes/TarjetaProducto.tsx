"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Producto } from "@/lib/baseDatos";

export function TarjetaProducto({
  producto,
  idCuenta,
  onEditar,
  onAlternar,
  onBorrar,
}: {
  producto: Producto;
  idCuenta: string;
  onEditar: () => void;
  onAlternar: () => void;
  onBorrar: () => void;
}) {
  const [interesados, setInteresados] = useState<number | null>(null);

  useEffect(() => {
    fetch(
      `/api/cuentas/${idCuenta}/productos/${producto.id}/clientes-interesados`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { interesados: unknown[] } | null) => {
        if (d) setInteresados(d.interesados.length);
      })
      .catch(() => setInteresados(null));
  }, [idCuenta, producto.id]);

  const urlImagen = producto.imagen_path
    ? `/api/productos/${producto.imagen_path}`
    : null;
  const sinStock = producto.stock != null && producto.stock <= 0;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition-all dark:bg-zinc-900 ${
        !producto.esta_activo
          ? "border-zinc-200 opacity-60 dark:border-zinc-800"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
        {urlImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlImagen}
            alt={producto.nombre}
            className="h-full w-full object-cover"
          />
        ) : producto.video_path ? (
          <video
            src={`/api/productos/${producto.video_path}`}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        {!producto.esta_activo && (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Pausado
          </span>
        )}
        {sinStock && producto.esta_activo && (
          <span className="absolute left-2 top-2 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Sin stock
          </span>
        )}
        {producto.video_path && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Video
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {producto.nombre}
          </h3>
          {producto.precio != null ? (
            <p className="shrink-0 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {producto.precio.toLocaleString("es-CO")} {producto.moneda}
            </p>
          ) : (
            <p className="shrink-0 text-[11px] italic text-zinc-500">
              consultar
            </p>
          )}
        </div>
        {producto.categoria && (
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
            {producto.categoria}
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400">
          {producto.descripcion || "Sin descripción"}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-zinc-500">
            {producto.stock != null && (
              <span>
                Stock: <strong>{producto.stock}</strong>
              </span>
            )}
            {producto.sku && <span className="font-mono">{producto.sku}</span>}
          </div>
          {interesados !== null && interesados > 0 && (
            <Link
              href={`/app/cuentas/${idCuenta}/productos/${producto.id}/interesados`}
              className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300"
            >
              {interesados} interesado{interesados === 1 ? "" : "s"}
            </Link>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={onEditar}
            className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onAlternar}
            className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            {producto.esta_activo ? "Pausar" : "Activar"}
          </button>
          <button
            type="button"
            onClick={onBorrar}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:border-zinc-800 dark:hover:bg-red-500/10"
            title="Borrar"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
