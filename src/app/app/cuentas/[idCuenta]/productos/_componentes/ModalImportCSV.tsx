"use client";

import { useMemo, useRef, useState } from "react";

interface Props {
  idCuenta: string;
  onCerrar: () => void;
  onImportado: () => void;
}

type CampoInterno =
  | "ignorar"
  | "nombre"
  | "descripcion"
  | "precio"
  | "moneda"
  | "stock"
  | "sku"
  | "categoria"
  | "imagen_url_externa";

const CAMPOS: Array<{ valor: CampoInterno; etiqueta: string }> = [
  { valor: "ignorar", etiqueta: "(ignorar)" },
  { valor: "nombre", etiqueta: "Nombre" },
  { valor: "descripcion", etiqueta: "Descripción" },
  { valor: "precio", etiqueta: "Precio" },
  { valor: "moneda", etiqueta: "Moneda" },
  { valor: "stock", etiqueta: "Stock" },
  { valor: "sku", etiqueta: "SKU" },
  { valor: "categoria", etiqueta: "Categoría" },
  { valor: "imagen_url_externa", etiqueta: "Imagen URL" },
];

/** Parser CSV simple: maneja comillas dobles y comas escapadas con "" */
function parsearCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let actual: string[] = [];
  let campo = "";
  let dentroComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!;
    if (dentroComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroComillas = false;
        }
      } else {
        campo += c;
      }
    } else {
      if (c === '"') {
        dentroComillas = true;
      } else if (c === ",") {
        actual.push(campo);
        campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        actual.push(campo);
        campo = "";
        if (actual.some((v) => v.trim() !== "")) filas.push(actual);
        actual = [];
      } else {
        campo += c;
      }
    }
  }
  if (campo !== "" || actual.length > 0) {
    actual.push(campo);
    if (actual.some((v) => v.trim() !== "")) filas.push(actual);
  }
  return filas;
}

/** Mapeo automático por nombre exacto (case-insensitive, sin acentos). */
function mapearPorDefault(headers: string[]): CampoInterno[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9_]/g, "_");
  const equivalencias: Record<string, CampoInterno> = {
    nombre: "nombre",
    name: "nombre",
    title: "nombre",
    titulo: "nombre",
    descripcion: "descripcion",
    description: "descripcion",
    desc: "descripcion",
    precio: "precio",
    price: "precio",
    moneda: "moneda",
    currency: "moneda",
    stock: "stock",
    cantidad: "stock",
    qty: "stock",
    quantity: "stock",
    sku: "sku",
    codigo: "sku",
    code: "sku",
    categoria: "categoria",
    category: "categoria",
    imagen: "imagen_url_externa",
    imagen_url: "imagen_url_externa",
    image: "imagen_url_externa",
    image_url: "imagen_url_externa",
    foto: "imagen_url_externa",
    foto_url: "imagen_url_externa",
  };
  return headers.map((h) => equivalencias[norm(h)] ?? "ignorar");
}

export function ModalImportCSV({ idCuenta, onCerrar, onImportado }: Props) {
  const [filas, setFilas] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState<CampoInterno[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{
    creados: number;
    errores: Array<{ fila: number; error: string }>;
  } | null>(null);
  const refInput = useRef<HTMLInputElement>(null);

  function recibirArchivo(file: File) {
    setError(null);
    setResultado(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("El archivo debe ser .csv");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo es muy grande (máx 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const texto = String(reader.result ?? "");
      const parseado = parsearCSV(texto);
      if (parseado.length < 2) {
        setError("CSV vacío o sin datos (necesita header + al menos 1 fila)");
        return;
      }
      const hdr = parseado[0]!.map((h) => h.trim());
      setHeaders(hdr);
      setMapeo(mapearPorDefault(hdr));
      setFilas(parseado.slice(1));
    };
    reader.onerror = () => setError("No se pudo leer el archivo");
    reader.readAsText(file, "utf-8");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) recibirArchivo(file);
  }

  const productosParaImportar = useMemo(() => {
    if (!filas) return [];
    const idxNombre = mapeo.indexOf("nombre");
    if (idxNombre === -1) return [];
    return filas
      .map((f) => {
        const obj: Record<string, string> = {};
        for (let i = 0; i < mapeo.length; i++) {
          const campo = mapeo[i]!;
          if (campo === "ignorar") continue;
          const v = (f[i] ?? "").trim();
          if (v) obj[campo] = v;
        }
        return obj;
      })
      .filter((o) => o.nombre && o.nombre.length >= 2);
  }, [filas, mapeo]);

  async function importar() {
    if (importando || productosParaImportar.length === 0) return;
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/productos/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: productosParaImportar }),
      });
      const data = (await res.json()) as {
        creados?: number;
        errores?: Array<{ fila: number; error: string }>;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Error HTTP ${res.status}`);
        return;
      }
      setResultado({
        creados: data.creados ?? 0,
        errores: data.errores ?? [],
      });
      if ((data.creados ?? 0) > 0) onImportado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setImportando(false);
    }
  }

  const previa = filas?.slice(0, 5) ?? [];
  const sinNombreMapeado = filas !== null && !mapeo.includes("nombre");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Importar productos desde CSV
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Cerrar"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {!filas && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950"
            }`}
          >
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Arrastrá un archivo .csv acá o
            </p>
            <button
              type="button"
              onClick={() => refInput.current?.click()}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              Elegir archivo
            </button>
            <input
              ref={refInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) recibirArchivo(f);
              }}
            />
            <p className="mt-2 text-[11px] text-zinc-500">
              Primera fila = nombres de columnas. Encoding UTF-8. Máx 5MB / 500 filas.
            </p>
          </div>
        )}

        {filas && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Mapear columnas del CSV
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                      {h || <em className="text-zinc-400">(sin nombre)</em>}
                    </span>
                    <span className="text-zinc-400">→</span>
                    <select
                      value={mapeo[i] ?? "ignorar"}
                      onChange={(e) => {
                        const m = [...mapeo];
                        m[i] = e.target.value as CampoInterno;
                        setMapeo(m);
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      {CAMPOS.map((c) => (
                        <option key={c.valor} value={c.valor}>
                          {c.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {sinNombreMapeado && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Tenés que mapear al menos una columna a &quot;Nombre&quot;.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Vista previa (primeras 5 filas)
              </p>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-950">
                    <tr>
                      {headers.map((h, i) => (
                        <th
                          key={i}
                          className="px-2 py-1.5 text-left font-semibold text-zinc-600 dark:text-zinc-400"
                        >
                          {h}
                          <div className="text-[10px] font-normal text-zinc-400">
                            {mapeo[i] === "ignorar" ? "—" : mapeo[i]}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previa.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-zinc-100 dark:border-zinc-800"
                      >
                        {headers.map((_, j) => (
                          <td
                            key={j}
                            className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300"
                          >
                            {row[j] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                {filas.length} filas detectadas · {productosParaImportar.length} válidas para importar
              </p>
            </div>

            {resultado && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                <p className="font-semibold">
                  {resultado.creados} creados, {resultado.errores.length} errores
                </p>
                {resultado.errores.length > 0 && (
                  <ul className="mt-1 max-h-32 overflow-y-auto">
                    {resultado.errores.slice(0, 20).map((e, idx) => (
                      <li key={idx}>
                        Fila {e.fila}: {e.error}
                      </li>
                    ))}
                    {resultado.errores.length > 20 && (
                      <li>… y {resultado.errores.length - 20} más</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilas(null);
                  setHeaders([]);
                  setMapeo([]);
                  setResultado(null);
                  setError(null);
                }}
                disabled={importando}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              >
                Elegir otro archivo
              </button>
              {resultado ? (
                <button
                  type="button"
                  onClick={onCerrar}
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  Cerrar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={importar}
                  disabled={
                    importando ||
                    sinNombreMapeado ||
                    productosParaImportar.length === 0
                  }
                  className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importando
                    ? "Importando..."
                    : `Importar ${productosParaImportar.length} producto${productosParaImportar.length === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </div>
        )}

        {!filas && error && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
