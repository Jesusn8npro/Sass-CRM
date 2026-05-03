"use client";

import { useEffect, useRef, useState } from "react";
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

interface RespuestaSubirArchivo {
  ok?: boolean;
  ruta?: string;
  error?: string;
}

type ModoBase = "producto" | "subir" | "ninguna";
type ModoPrompt = "preset" | "custom";

export default function PaginaEstudio() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [modoBase, setModoBase] = useState<ModoBase>("ninguna");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [archivoSubido, setArchivoSubido] = useState<{
    ruta: string;
    nombre: string;
  } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [modoPrompt, setModoPrompt] = useState<ModoPrompt>("preset");
  const [presetActivo, setPresetActivo] = useState<PresetImagen | null>(
    PRESETS_IMAGEN[0] ?? null,
  );
  const [promptCustom, setPromptCustom] = useState("");
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refInputArchivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!idCuenta) return;
    fetch(`/api/cuentas/${idCuenta}/productos`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RespuestaProductos | null) => {
        if (d) setProductos(d.productos);
      })
      .catch(() => {});
  }, [idCuenta]);

  async function subirArchivo(file: File) {
    if (subiendo) return;
    setSubiendo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const r = await fetch(`/api/cuentas/${idCuenta}/imagenes/subir`, {
        method: "POST",
        body: fd,
      });
      const data = (await r.json()) as RespuestaSubirArchivo;
      if (!r.ok || !data.ruta) {
        setError(data.error ?? "No se pudo subir el archivo");
      } else {
        setArchivoSubido({ ruta: data.ruta, nombre: file.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red al subir");
    } finally {
      setSubiendo(false);
      if (refInputArchivo.current) refInputArchivo.current.value = "";
    }
  }

  function rutaImagenBase(): string | null {
    if (modoBase === "producto") {
      const prod = productos.find((p) => p.id === seleccionado);
      return prod?.imagen_url
        ? extraerRutaInterna(prod.imagen_url, idCuenta)
        : null;
    }
    if (modoBase === "subir") {
      return archivoSubido ? `biblio:${archivoSubido.ruta}` : null;
    }
    return null;
  }

  async function generar() {
    if (generando) return;
    if (modoPrompt === "preset" && !presetActivo) return;
    if (modoPrompt === "custom" && promptCustom.trim().length < 10) {
      setError("El prompt custom debe tener al menos 10 caracteres");
      return;
    }
    setGenerando(true);
    setResultado(null);
    setError(null);

    const body =
      modoPrompt === "preset"
        ? { preset_id: presetActivo!.id, ruta_imagen_base: rutaImagenBase() }
        : { prompt: promptCustom.trim(), ruta_imagen_base: rutaImagenBase() };

    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/imagenes/generar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
          <h2 className="mb-3 text-sm font-semibold">1. Imagen base (opcional)</h2>
          <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 p-1 text-xs dark:border-zinc-800">
            {(["ninguna", "producto", "subir"] as ModoBase[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModoBase(m)}
                className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
                  modoBase === m
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {m === "ninguna"
                  ? "Sin base"
                  : m === "producto"
                  ? "De un producto"
                  : "Subir foto"}
              </button>
            ))}
          </div>

          {modoBase === "producto" && (
            productos.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Todavía no tenés productos. Cambiá a "Subir foto" o "Sin base".
              </p>
            ) : (
              <select
                value={seleccionado ?? ""}
                onChange={(e) => setSeleccionado(e.target.value || null)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">— Elegí un producto —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {!p.imagen_url ? " (sin imagen)" : ""}
                  </option>
                ))}
              </select>
            )
          )}

          {modoBase === "subir" && (
            <div>
              <input
                ref={refInputArchivo}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirArchivo(f);
                }}
              />
              {archivoSubido ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                  <span className="truncate">📎 {archivoSubido.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setArchivoSubido(null)}
                    className="shrink-0 text-rose-600 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => refInputArchivo.current?.click()}
                  disabled={subiendo}
                  className="w-full rounded-lg border-2 border-dashed border-zinc-300 px-3 py-6 text-xs text-zinc-500 hover:border-emerald-500/40 hover:bg-emerald-500/5 disabled:opacity-50 dark:border-zinc-700"
                >
                  {subiendo ? "Subiendo…" : "📤 Click para subir foto JPG/PNG"}
                </button>
              )}
            </div>
          )}

          {modoBase === "ninguna" && (
            <p className="text-xs text-zinc-500">
              La IA va a generar la imagen desde el prompt sin foto de referencia.
            </p>
          )}

          <h2 className="mb-3 mt-6 text-sm font-semibold">2. Qué generar</h2>
          <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 p-1 text-xs dark:border-zinc-800">
            {(["preset", "custom"] as ModoPrompt[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModoPrompt(m)}
                className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${
                  modoPrompt === m
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {m === "preset" ? "Preset rápido" : "Prompt personalizado"}
              </button>
            ))}
          </div>

          {modoPrompt === "preset" ? (
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
          ) : (
            <textarea
              value={promptCustom}
              onChange={(e) => setPromptCustom(e.target.value)}
              rows={5}
              placeholder="Describí cómo querés que sea la imagen. Ej: 'Producto sobre fondo de mármol blanco, iluminación cinematográfica desde la izquierda, sin texto ni logos.'"
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          )}

          <button
            type="button"
            onClick={generar}
            disabled={generando}
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
