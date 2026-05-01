"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Cuenta, Producto } from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaProductos {
  productos: Producto[];
}

const MONEDAS = ["COP", "USD", "ARS", "MXN", "EUR", "PEN", "CLP"];

export default function PaginaProductos() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = Number(params?.idCuenta);

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
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

  function abrirEditar(id: number) {
    setEditando(id);
    setModalAbierto(true);
  }

  async function alternarActivo(p: Producto) {
    await fetch(`/api/cuentas/${idCuenta}/productos/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ esta_activo: p.esta_activo === 1 ? 0 : 1 }),
    });
    cargar();
  }

  async function borrar(id: number) {
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
              href="/"
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
              href={`/cuentas/${idCuenta}/dashboard`}
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

function TarjetaProducto({
  producto,
  idCuenta,
  onEditar,
  onAlternar,
  onBorrar,
}: {
  producto: Producto;
  idCuenta: number;
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
        producto.esta_activo === 0
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
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        {producto.esta_activo === 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Pausado
          </span>
        )}
        {sinStock && producto.esta_activo === 1 && (
          <span className="absolute left-2 top-2 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Sin stock
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
              href={`/cuentas/${idCuenta}/productos/${producto.id}/interesados`}
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
            {producto.esta_activo === 1 ? "Pausar" : "Activar"}
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

function ModalProducto({
  idCuenta,
  idEditar,
  productoActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: number;
  idEditar: number | null;
  productoActual: Producto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(productoActual?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(
    productoActual?.descripcion ?? "",
  );
  const [precio, setPrecio] = useState<string>(
    productoActual?.precio != null ? String(productoActual.precio) : "",
  );
  const [moneda, setMoneda] = useState(productoActual?.moneda ?? "COP");
  const [costo, setCosto] = useState<string>(
    productoActual?.costo != null ? String(productoActual.costo) : "",
  );
  const [stock, setStock] = useState<string>(
    productoActual?.stock != null ? String(productoActual.stock) : "",
  );
  const [sku, setSku] = useState(productoActual?.sku ?? "");
  const [categoria, setCategoria] = useState(productoActual?.categoria ?? "");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [imagenActual, setImagenActual] = useState(
    productoActual?.imagen_path ?? null,
  );
  const refInput = useRef<HTMLInputElement>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const url = idEditar
        ? `/api/cuentas/${idCuenta}/productos/${idEditar}`
        : `/api/cuentas/${idCuenta}/productos`;
      const metodo = idEditar ? "PATCH" : "POST";
      const cuerpo = {
        nombre: nombre.trim(),
        descripcion,
        precio: precio.trim() === "" ? null : Number(precio),
        moneda,
        costo: costo.trim() === "" ? null : Number(costo),
        stock: stock.trim() === "" ? null : Number(stock),
        sku: sku.trim() || null,
        categoria: categoria.trim() || null,
      };
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Error HTTP ${res.status}`);
        return;
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  async function subirImagen(file: File) {
    if (!idEditar) {
      setError(
        "Guardá el producto primero (el botón abajo) y después podés subir imagen.",
      );
      return;
    }
    if (subiendoImagen) return;
    setSubiendoImagen(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const res = await fetch(
        `/api/cuentas/${idCuenta}/productos/${idEditar}/imagen`,
        { method: "POST", body: fd },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Error subiendo imagen`);
        return;
      }
      const d = (await res.json()) as { producto: Producto };
      setImagenActual(d.producto.imagen_path ?? null);
    } finally {
      setSubiendoImagen(false);
      if (refInput.current) refInput.current.value = "";
    }
  }

  async function quitarImagen() {
    if (!idEditar) return;
    if (!confirm("¿Quitar la imagen?")) return;
    await fetch(`/api/cuentas/${idCuenta}/productos/${idEditar}/imagen`, {
      method: "DELETE",
    });
    setImagenActual(null);
  }

  const urlImagen = imagenActual ? `/api/productos/${imagenActual}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {idEditar ? "Editar producto" : "Nuevo producto"}
        </h2>

        <form onSubmit={guardar} className="flex flex-col gap-3">
          {/* Imagen */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Imagen
            </label>
            <div className="flex items-center gap-3">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                {urlImagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlImagen} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={refInput}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) subirImagen(f);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => refInput.current?.click()}
                  disabled={!idEditar || subiendoImagen}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  {subiendoImagen
                    ? "Subiendo..."
                    : urlImagen
                    ? "Cambiar imagen"
                    : "Subir imagen"}
                </button>
                {urlImagen && (
                  <button
                    type="button"
                    onClick={quitarImagen}
                    className="ml-2 text-[11px] text-red-600 hover:underline dark:text-red-400"
                  >
                    Quitar
                  </button>
                )}
                {!idEditar && (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Guardá primero, después podés subir imagen.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={100}
              placeholder="Ej: Acordeón Hohner Corona III"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Detalle del producto. Lo va a leer el agente para responder."
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Precio
              </label>
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                step="0.01"
                placeholder="vacío = consultar"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Moneda
              </label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Costo (interno)
              </label>
              <input
                type="number"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                step="0.01"
                placeholder="opcional"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Stock
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                min={0}
                placeholder="vacío = no controla"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                SKU / Código
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="opcional"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Categoría
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: Acordeones"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !nombre.trim()}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando..." : idEditar ? "Guardar cambios" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
