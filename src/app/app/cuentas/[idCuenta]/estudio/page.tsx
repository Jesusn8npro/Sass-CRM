"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PRESETS_IMAGEN, type PresetImagen } from "@/lib/imagenes/presets";

interface Producto {
  id: string;
  nombre: string;
  imagen_url: string | null;
}

interface RespuestaProductos {
  productos: Producto[];
}

interface RespuestaGenerar {
  ok: boolean;
  ruta?: string;
  mensaje?: string;
  error?: string;
  requeridos?: number;
}

export default function PaginaEstudio() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [presetActivo, setPresetActivo] = useState<PresetImagen | null>(
    PRESETS_IMAGEN[0] ?? null,
  );
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idCuenta) return;
    fetch(`/api/cuentas/${idCuenta}/productos`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RespuestaProductos | null) => {
        if (d) setProductos(d.productos);
      })
      .catch(() => {});
  }, [idCuenta]);

  async function generar() {
    if (!presetActivo || generando) return;
    setGenerando(true);
    setResultado(null);
    setError(null);

    const prodSeleccionado = productos.find((p) => p.id === seleccionado);
    const rutaBase = prodSeleccionado?.imagen_url
      ? extraerRutaInterna(prodSeleccionado.imagen_url, idCuenta)
      : null;

    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/imagenes/generar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preset_id: presetActivo.id,
            ruta_imagen_base: rutaBase,
          }),
        },
      );
      const data = (await r.json()) as RespuestaGenerar;
      if (!r.ok || !data.ok) {
        setError(
          data.mensaje ??
            data.error ??
            `Error ${r.status} al generar la imagen`,
        );
      } else if (data.ruta) {
        setResultado(data.ruta);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          IA · Imágenes
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Estudio de imágenes
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Generá imágenes profesionales para tus productos con IA. Elegí un
          producto, un preset, y listo. 1 crédito = 1 imagen.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Columna izquierda: form */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold">1. Producto base</h2>
          {productos.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Todavía no tenés productos. Podés generar sin imagen base
              (text-to-image) o crear uno primero.
            </p>
          ) : (
            <select
              value={seleccionado ?? ""}
              onChange={(e) => setSeleccionado(e.target.value || null)}
              className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Sin imagen base (text-to-image)</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {!p.imagen_url ? " (sin imagen)" : ""}
                </option>
              ))}
            </select>
          )}

          <h2 className="mb-3 mt-6 text-sm font-semibold">2. Estilo</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRESETS_IMAGEN.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetActivo(p)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                  presetActivo?.id === p.id
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                }`}
              >
                <p className="font-semibold">
                  {p.emoji} {p.etiqueta}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {p.descripcion}
                </p>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={generar}
            disabled={!presetActivo || generando}
            className="mt-6 w-full rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generando ? "Generando…" : "Generar imagen (1 crédito)"}
          </button>

          {error && (
            <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}
        </section>

        {/* Columna derecha: preview */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold">Resultado</h2>
          {resultado ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/biblioteca/${idCuenta}/${resultado.replace("biblio:", "").split("/").slice(1).join("/")}`}
                alt="Imagen generada"
                className="w-full rounded-xl"
              />
              <p className="break-all rounded-lg bg-zinc-100 px-2 py-1 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {resultado}
              </p>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700">
              {generando ? "Esperando a Nano Banana…" : "Sin resultado todavía"}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Convierte una URL pública del producto a la ruta interna que el
 * endpoint /imagenes/generar entiende. Soporta varias formas:
 *  - "/api/biblioteca/<idC>/archivo.png" → "biblio:<idC>/archivo.png"
 *  - "/api/media/<idC>/archivo.png"      → "<idC>/archivo.png" (productos)
 *  - URL absoluta de Supabase Storage    → null (no soportado, fallback
 *                                          a text-to-image)
 */
function extraerRutaInterna(
  imagenUrl: string,
  idCuenta: string,
): string | null {
  if (imagenUrl.includes(`/api/biblioteca/${idCuenta}/`)) {
    const archivo = imagenUrl.split(`/api/biblioteca/${idCuenta}/`)[1];
    return archivo ? `biblio:${idCuenta}/${archivo}` : null;
  }
  if (imagenUrl.includes(`/api/media/${idCuenta}/`)) {
    const archivo = imagenUrl.split(`/api/media/${idCuenta}/`)[1];
    return archivo ? `${idCuenta}/${archivo}` : null;
  }
  return null;
}
