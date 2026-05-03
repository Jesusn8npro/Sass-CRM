"use client";

import { useRef, useState } from "react";
import type { Producto } from "@/lib/baseDatos";
import { PanelUploadsProducto } from "./_modalProducto-uploads";
import { MONEDAS } from "@/lib/constantes";

export function ModalProducto({
  idCuenta,
  idEditar,
  productoActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  idEditar: string | null;
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

  // Imagen: si hay una pendiente (File en memoria), se sube tras guardar.
  // Si ya hay una guardada en server (productoActual.imagen_path), la mostramos.
  const [imagenPendiente, setImagenPendiente] = useState<File | null>(null);
  const [imagenActual, setImagenActual] = useState(
    productoActual?.imagen_path ?? null,
  );
  const refInputImagen = useRef<HTMLInputElement>(null);

  // Video: igual que imagen.
  const [videoPendiente, setVideoPendiente] = useState<File | null>(null);
  const [videoActual, setVideoActual] = useState(
    productoActual?.video_path ?? null,
  );
  const refInputVideo = useRef<HTMLInputElement>(null);

  // URLs locales (para preview de archivos en memoria) — useMemo para no
  // crear un objectURL nuevo en cada render.
  const urlImagenLocal = imagenPendiente
    ? URL.createObjectURL(imagenPendiente)
    : null;
  const urlVideoLocal = videoPendiente
    ? URL.createObjectURL(videoPendiente)
    : null;
  const urlImagen = urlImagenLocal
    ? urlImagenLocal
    : imagenActual
    ? `/api/productos/${imagenActual}`
    : null;
  const urlVideo = urlVideoLocal
    ? urlVideoLocal
    : videoActual
    ? `/api/productos/${videoActual}`
    : null;

  async function subirArchivo(
    productoId: string,
    tipo: "imagen" | "video",
    file: File,
  ): Promise<boolean> {
    const fd = new FormData();
    fd.append("archivo", file);
    const res = await fetch(
      `/api/cuentas/${idCuenta}/productos/${productoId}/${tipo}`,
      { method: "POST", body: fd },
    );
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(`Error subiendo ${tipo}: ${d.error ?? `HTTP ${res.status}`}`);
      return false;
    }
    return true;
  }

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
      const data = (await res.json()) as { producto: Producto };
      const productoId = data.producto.id;

      // Si hay imagen pendiente o video pendiente → subir ahora.
      if (imagenPendiente) {
        const ok = await subirArchivo(productoId, "imagen", imagenPendiente);
        if (!ok) return;
      }
      if (videoPendiente) {
        const ok = await subirArchivo(productoId, "video", videoPendiente);
        if (!ok) return;
      }

      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  function elegirImagen(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Imagen muy grande (máx 8MB)");
      return;
    }
    setImagenPendiente(file);
  }
  function elegirVideo(file: File) {
    if (!file.type.startsWith("video/")) {
      setError("El archivo debe ser un video");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Video muy grande (máx 50MB)");
      return;
    }
    setVideoPendiente(file);
  }

  async function quitarImagen() {
    if (imagenPendiente) {
      setImagenPendiente(null);
      if (refInputImagen.current) refInputImagen.current.value = "";
      return;
    }
    if (!idEditar || !imagenActual) return;
    if (!confirm("¿Quitar la imagen guardada?")) return;
    await fetch(`/api/cuentas/${idCuenta}/productos/${idEditar}/imagen`, {
      method: "DELETE",
    });
    setImagenActual(null);
  }
  async function quitarVideo() {
    if (videoPendiente) {
      setVideoPendiente(null);
      if (refInputVideo.current) refInputVideo.current.value = "";
      return;
    }
    if (!idEditar || !videoActual) return;
    if (!confirm("¿Quitar el video guardado?")) return;
    await fetch(`/api/cuentas/${idCuenta}/productos/${idEditar}/video`, {
      method: "DELETE",
    });
    setVideoActual(null);
  }

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
          <PanelUploadsProducto
            urlImagen={urlImagen}
            urlVideo={urlVideo}
            imagenPendiente={imagenPendiente}
            videoPendiente={videoPendiente}
            refInputImagen={refInputImagen}
            refInputVideo={refInputVideo}
            guardando={guardando}
            elegirImagen={elegirImagen}
            elegirVideo={elegirVideo}
            quitarImagen={quitarImagen}
            quitarVideo={quitarVideo}
          />

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
