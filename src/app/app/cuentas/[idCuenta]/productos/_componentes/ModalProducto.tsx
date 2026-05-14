"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Producto } from "@/lib/baseDatos";
import { PanelUploadsProducto } from "./_modalProducto-uploads";
import { MONEDAS } from "@/lib/constantes";
import { useConfirm } from "@/components/ConfirmDialog";

// Todos los inputs son strings (así trabaja el DOM / react-hook-form con inputs
// type="number"). La coerción a number ocurre en el handler guardar().
const esquema = z
  .object({
    nombre: z
      .string()
      .min(1, "El nombre es obligatorio")
      .max(100, "Máximo 100 caracteres"),
    descripcion: z.string().max(2000, "Máximo 2000 caracteres"),
    precio: z.string(),
    moneda: z.string().min(1),
    costo: z.string(),
    stock: z.string(),
    sku: z.string().max(80, "Máximo 80 caracteres"),
    categoria: z.string().max(80, "Máximo 80 caracteres"),
  })
  .superRefine((d, ctx) => {
    const validarNumerico = (campo: "precio" | "costo", val: string) => {
      if (val.trim() === "") return;
      if (isNaN(parseFloat(val)))
        ctx.addIssue({ code: "custom", path: [campo], message: "Debe ser un número" });
      else if (parseFloat(val) < 0)
        ctx.addIssue({ code: "custom", path: [campo], message: "No puede ser negativo" });
    };
    validarNumerico("precio", d.precio);
    validarNumerico("costo", d.costo);
    if (d.stock.trim() !== "") {
      if (isNaN(parseInt(d.stock, 10)))
        ctx.addIssue({ code: "custom", path: ["stock"], message: "Debe ser un número entero" });
      else if (parseInt(d.stock, 10) < 0)
        ctx.addIssue({ code: "custom", path: ["stock"], message: "No puede ser negativo" });
    }
  });
type Datos = z.infer<typeof esquema>;

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
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const { confirmar } = useConfirm();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: productoActual?.nombre ?? "",
      descripcion: productoActual?.descripcion ?? "",
      precio: productoActual?.precio != null ? String(productoActual.precio) : "",
      moneda: productoActual?.moneda ?? "COP",
      costo: productoActual?.costo != null ? String(productoActual.costo) : "",
      stock: productoActual?.stock != null ? String(productoActual.stock) : "",
      sku: productoActual?.sku ?? "",
      categoria: productoActual?.categoria ?? "",
    },
  });

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
      setErrorServidor(`Error subiendo ${tipo}: ${d.error ?? `HTTP ${res.status}`}`);
      return false;
    }
    return true;
  }

  async function guardar(datos: Datos) {
    setErrorServidor(null);
    try {
      const url = idEditar
        ? `/api/cuentas/${idCuenta}/productos/${idEditar}`
        : `/api/cuentas/${idCuenta}/productos`;
      const metodo = idEditar ? "PATCH" : "POST";
      const cuerpo = {
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion,
        precio: datos.precio.trim() === "" ? null : Number(datos.precio),
        moneda: datos.moneda,
        costo: datos.costo.trim() === "" ? null : Number(datos.costo),
        stock: datos.stock.trim() === "" ? null : Number(datos.stock),
        sku: datos.sku.trim() || null,
        categoria: datos.categoria.trim() || null,
      };
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorServidor(d.error ?? `Error HTTP ${res.status}`);
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
      setErrorServidor(err instanceof Error ? err.message : "Error de red");
    }
  }

  function elegirImagen(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorServidor("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorServidor("Imagen muy grande (máx 8MB)");
      return;
    }
    setImagenPendiente(file);
  }
  function elegirVideo(file: File) {
    if (!file.type.startsWith("video/")) {
      setErrorServidor("El archivo debe ser un video");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorServidor("Video muy grande (máx 50MB)");
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
    const ok = await confirmar({
      mensaje: "¿Quitar la imagen guardada?",
      textoConfirmar: "Quitar",
      variante: "peligro",
    });
    if (!ok) return;
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
    const ok = await confirmar({
      mensaje: "¿Quitar el video guardado?",
      textoConfirmar: "Quitar",
      variante: "peligro",
    });
    if (!ok) return;
    await fetch(`/api/cuentas/${idCuenta}/productos/${idEditar}/video`, {
      method: "DELETE",
    });
    setVideoActual(null);
  }

  const inputClases = (conError: boolean) =>
    `w-full rounded-xl border px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 ${
      conError
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
        : "border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-emerald-500/15"
    } focus:outline-none focus:ring-2`;

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

        <form onSubmit={handleSubmit(guardar)} className="flex flex-col gap-3">
          <PanelUploadsProducto
            urlImagen={urlImagen}
            urlVideo={urlVideo}
            imagenPendiente={imagenPendiente}
            videoPendiente={videoPendiente}
            refInputImagen={refInputImagen}
            refInputVideo={refInputVideo}
            guardando={isSubmitting}
            elegirImagen={elegirImagen}
            elegirVideo={elegirVideo}
            quitarImagen={quitarImagen}
            quitarVideo={quitarVideo}
          />

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register("nombre")}
              maxLength={100}
              placeholder="Ej: Acordeón Hohner Corona III"
              aria-invalid={!!errors.nombre}
              className={inputClases(!!errors.nombre)}
            />
            {errors.nombre && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                {errors.nombre.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Descripción
            </label>
            <textarea
              {...register("descripcion")}
              rows={3}
              placeholder="Detalle del producto. Lo va a leer el agente para responder."
              aria-invalid={!!errors.descripcion}
              className={`resize-none ${inputClases(!!errors.descripcion)}`}
            />
            {errors.descripcion && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                {errors.descripcion.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Precio
              </label>
              <input
                type="number"
                {...register("precio")}
                step="0.01"
                placeholder="vacío = consultar"
                aria-invalid={!!errors.precio}
                className={inputClases(!!errors.precio)}
              />
              {errors.precio && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.precio.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Moneda
              </label>
              <select
                {...register("moneda")}
                className={inputClases(false)}
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
                {...register("costo")}
                step="0.01"
                placeholder="opcional"
                aria-invalid={!!errors.costo}
                className={inputClases(!!errors.costo)}
              />
              {errors.costo && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.costo.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Stock
              </label>
              <input
                type="number"
                {...register("stock")}
                min={0}
                placeholder="vacío = no controla"
                aria-invalid={!!errors.stock}
                className={inputClases(!!errors.stock)}
              />
              {errors.stock && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.stock.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                SKU / Código
              </label>
              <input
                type="text"
                {...register("sku")}
                placeholder="opcional"
                aria-invalid={!!errors.sku}
                className={`font-mono ${inputClases(!!errors.sku)}`}
              />
              {errors.sku && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.sku.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Categoría
              </label>
              <input
                type="text"
                {...register("categoria")}
                placeholder="Ej: Acordeones"
                aria-invalid={!!errors.categoria}
                className={inputClases(!!errors.categoria)}
              />
              {errors.categoria && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.categoria.message}
                </p>
              )}
            </div>
          </div>

          {errorServidor && (
            <div
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300"
              role="alert"
            >
              {errorServidor}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={isSubmitting}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Guardando..." : idEditar ? "Guardar cambios" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
