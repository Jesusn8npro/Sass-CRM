"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Cuenta, Producto } from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";
import { TarjetaProducto } from "./_componentes/TarjetaProducto";
import { ModalProducto } from "./_componentes/ModalProducto";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaProductos {
  productos: Producto[];
}

export default function PaginaProductos() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const [resCuenta, resProds] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/productos`, { cache: "no-store" }),
      ]);
      if (resCuenta.ok) {
        const d = (await resCuenta.json()) as RespuestaCuenta;
        setCuenta(d.cuenta);
      }
      if (resProds.ok) {
        const d = (await resProds.json()) as RespuestaProductos;
        setProductos(d.productos);
      }
    } catch (err) {
      console.error("[productos] error:", err);
    }
  }, [idCuenta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(id: string) {
    setEditando(id);
    setModalAbierto(true);
  }

  async function alternarActivo(p: Producto) {
    await fetch(`/api/cuentas/${idCuenta}/productos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esta_activo: !p.esta_activo }),
    });
    cargar();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este producto? El historial de interés queda guardado."))
      return;
    await fetch(`/api/cuentas/${idCuenta}/productos/${id}`, {
      method: "DELETE",
    });
    cargar();
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Productos
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={abrirNuevo}
              className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-500 px-4 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              <span>Nuevo</span>
            </button>
            <Link
              href={`/app/cuentas/${idCuenta}/dashboard`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Dashboard
            </Link>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {productos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aún no hay productos
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Agregá tu primer producto. El agente lo va a usar automáticamente
              al chatear con clientes (precio, stock, descripción, foto).
            </p>
            <button
              type="button"
              onClick={abrirNuevo}
              className="mt-4 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              + Crear primer producto
            </button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {productos.map((p) => (
              <TarjetaProducto
                key={p.id}
                producto={p}
                idCuenta={idCuenta}
                onEditar={() => abrirEditar(p.id)}
                onAlternar={() => alternarActivo(p)}
                onBorrar={() => borrar(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalProducto
          idCuenta={idCuenta}
          idEditar={editando}
          productoActual={
            editando ? productos.find((p) => p.id === editando) ?? null : null
          }
          onCerrar={() => {
            setModalAbierto(false);
            setCreando(false);
          }}
          onGuardado={() => {
            setModalAbierto(false);
            setCreando(false);
            cargar();
          }}
        />
      )}
    </main>
  );
}
