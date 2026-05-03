"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { EntradaConocimiento } from "@/lib/baseDatos";

interface RespuestaConocimiento {
  entradas: EntradaConocimiento[];
}

const COLOR_CATEGORIA: Record<string, string> = {
  general: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  productos: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  precios: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  faqs: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  politicas: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  casos_uso: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  servicios: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
};

function colorParaCategoria(cat: string): string {
  return (
    COLOR_CATEGORIA[cat] ??
    "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300"
  );
}

const PLANTILLAS = [
  {
    nombre: "productos_servicios",
    titulo: "Productos y Servicios",
    descripcion: "Catálogo con precios, características y disponibilidad",
    icono: "📦",
    contenido: `# Productos y Servicios

## [Nombre del producto/servicio 1]
- Descripción: [qué es y para qué sirve]
- Precio: [valor o "consultar"]
- Disponibilidad: [stock, agenda, etc.]
- Características clave:
  - [feature 1]
  - [feature 2]
  - [feature 3]

## [Nombre del producto/servicio 2]
- Descripción: ...
- Precio: ...
- Disponibilidad: ...
- Características clave:
  - ...
`,
  },
  {
    nombre: "preguntas_frecuentes",
    titulo: "Preguntas Frecuentes",
    descripcion: "Formato pregunta-respuesta organizado por temas",
    icono: "❓",
    contenido: `# Preguntas Frecuentes (FAQ)

## ¿[Pregunta común 1]?
[Respuesta clara y completa, en 2-4 líneas máximo.]

## ¿[Pregunta común 2]?
[Respuesta...]

## ¿[Pregunta común 3]?
[Respuesta...]

---

Tip: agregá las preguntas que tu cliente realmente hace por WhatsApp.
Las que ves repetidas son las que más impactan en el agente.
`,
  },
  {
    nombre: "politicas_empresa",
    titulo: "Políticas de Empresa",
    descripcion: "Devoluciones, envíos, garantía y privacidad",
    icono: "📄",
    contenido: `# Políticas de la empresa

## Devoluciones
[Detalles de tu política de devoluciones]

## Envíos
- Zonas de cobertura: [...]
- Tiempos: [...]
- Costos: [...]

## Garantía
[Términos de la garantía]

## Privacidad
[Cómo manejás los datos de los clientes]
`,
  },
];

type Vista = "lista" | "buscar";

export default function PaginaConocimiento() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [entradas, setEntradas] = useState<EntradaConocimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activos" | "inactivos">("todos");
  const [modalEditor, setModalEditor] = useState<EntradaConocimiento | "nuevo" | null>(null);
  const [modalGuia, setModalGuia] = useState(false);
  const [modalBuscar, setModalBuscar] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensajeArchivo, setMensajeArchivo] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conocimiento`, {
        cache: "no-store",
      });
      if (res.ok) {
        const d = (await res.json()) as RespuestaConocimiento;
        setEntradas(d.entradas ?? []);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  const stats = useMemo(() => {
    const total = entradas.length;
    const activos = entradas.filter((e) => e.esta_activo !== false).length;
    const inactivos = total - activos;
    const cats = new Set<string>();
    for (const e of entradas) cats.add(e.categoria || "general");
    return { total, activos, inactivos, categorias: cats.size };
  }, [entradas]);

  const categoriasUnicas = useMemo(() => {
    const s = new Set<string>();
    for (const e of entradas) s.add(e.categoria || "general");
    return Array.from(s).sort();
  }, [entradas]);

  const filtradas = useMemo(() => {
    return entradas.filter((e) => {
      if (filtroCategoria !== "todas" && (e.categoria || "general") !== filtroCategoria) return false;
      if (filtroEstado === "activos" && e.esta_activo === false) return false;
      if (filtroEstado === "inactivos" && e.esta_activo !== false) return false;
      if (filtro) {
        const q = filtro.toLowerCase();
        return (
          e.titulo.toLowerCase().includes(q) ||
          e.contenido.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entradas, filtro, filtroCategoria, filtroEstado]);

  async function subirArchivo(archivo: File) {
    setSubiendo(true);
    setMensajeArchivo(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("categoria", "general");
      const res = await fetch(`/api/cuentas/${idCuenta}/conocimiento/subir`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { mensaje?: string; error?: string };
      if (!res.ok) {
        setMensajeArchivo(`✗ ${data.error ?? "Error subiendo archivo"}`);
        return;
      }
      setMensajeArchivo(`✓ ${data.mensaje ?? "Archivo subido"}`);
      await cargar();
    } catch (err) {
      setMensajeArchivo(
        `✗ ${err instanceof Error ? err.message : "Error de red"}`,
      );
    } finally {
      setSubiendo(false);
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hero + acciones */}
      <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-white via-violet-50/30 to-white px-6 pt-6 pb-4 dark:border-zinc-800 dark:from-zinc-950 dark:via-violet-950/10 dark:to-zinc-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-lg text-white shadow-md">
                📚
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                  Conocimiento del agente
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  Base de Conocimiento
                </h1>
                <p className="text-xs text-zinc-500">
                  Administra la información que tu agente IA utiliza para
                  responder a los clientes.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModalGuia(true)}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium hover:border-violet-500/30 hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-violet-950/30"
              >
                📖 Guía
              </button>
              <button
                type="button"
                onClick={() => setModalBuscar(true)}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium hover:border-violet-500/30 hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-violet-950/30"
              >
                🔍 Probar Búsqueda
              </button>
              <button
                type="button"
                onClick={() => cargar()}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium hover:border-violet-500/30 hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-violet-950/30"
              >
                🔄 Sincronizar
              </button>
              <button
                type="button"
                onClick={() => inputArchivo.current?.click()}
                disabled={subiendo}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium hover:border-violet-500/30 hover:bg-violet-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-violet-950/30"
              >
                {subiendo ? "Subiendo…" : "↑ Subir Archivo"}
              </button>
              <input
                ref={inputArchivo}
                type="file"
                accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirArchivo(f);
                }}
              />
              <button
                type="button"
                onClick={() => setModalEditor("nuevo")}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                + Nuevo
              </button>
            </div>
          </div>

          {mensajeArchivo && (
            <div
              className={`mb-3 rounded-xl px-3 py-2 text-xs ${
                mensajeArchivo.startsWith("✓")
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              }`}
            >
              {mensajeArchivo}
            </div>
          )}

          {/* Stats */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total Documentos"
              value={stats.total}
              icon="📄"
              accent="zinc"
            />
            <StatCard
              label="Activos"
              value={stats.activos}
              icon="✓"
              accent="emerald"
            />
            <StatCard
              label="Inactivos"
              value={stats.inactivos}
              icon="⏸"
              accent="amber"
            />
            <StatCard
              label="Categorías"
              value={stats.categorias}
              icon="🏷"
              accent="violet"
            />
          </div>

          {/* Buscador + filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 md:max-w-md">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                ⌕
              </span>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por título o contenido…"
                className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="todas">Todas las categorías</option>
              {categoriasUnicas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(e.target.value as "todos" | "activos" | "inactivos")
              }
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="todos">Todos</option>
              <option value="activos">Solo activos</option>
              <option value="inactivos">Solo inactivos</option>
            </select>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 px-6 py-5 dark:bg-zinc-950">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : entradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">Aún no hay documentos en la base</p>
            <p className="mt-1 text-xs text-zinc-500">
              Tocá &quot;+ Nuevo&quot; para crear uno, o &quot;↑ Subir
              Archivo&quot; para cargar un .txt o .md.
            </p>
            <button
              type="button"
              onClick={() => setModalGuia(true)}
              className="mt-4 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              📖 Ver guía y plantillas
            </button>
          </div>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            Ningún documento matchea los filtros.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((e) => (
              <CardConocimiento
                key={e.id}
                entrada={e}
                onClick={() => setModalEditor(e)}
              />
            ))}
          </div>
        )}
      </div>

      {modalGuia && <ModalGuia onCerrar={() => setModalGuia(false)} />}
      {modalBuscar && (
        <ModalBuscar
          entradas={entradas.filter((e) => e.esta_activo !== false)}
          onCerrar={() => setModalBuscar(false)}
        />
      )}
      {modalEditor && (
        <ModalEditor
          idCuenta={idCuenta}
          entrada={modalEditor === "nuevo" ? null : modalEditor}
          categoriasExistentes={categoriasUnicas}
          onCerrar={() => setModalEditor(null)}
          onGuardado={() => {
            setModalEditor(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Stat card
// ============================================================

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  accent: "zinc" | "emerald" | "amber" | "violet";
}) {
  const ringByAccent: Record<typeof accent, string> = {
    zinc: "ring-zinc-200 dark:ring-zinc-800",
    emerald:
      "ring-emerald-300/50 dark:ring-emerald-500/30 bg-gradient-to-br from-emerald-50/70 to-transparent dark:from-emerald-950/30",
    amber:
      "ring-amber-300/50 dark:ring-amber-500/30 bg-gradient-to-br from-amber-50/70 to-transparent dark:from-amber-950/30",
    violet:
      "ring-violet-300/50 dark:ring-violet-500/30 bg-gradient-to-br from-violet-50/70 to-transparent dark:from-violet-950/30",
  };
  const iconBg: Record<typeof accent, string> = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  };
  return (
    <div
      className={`rounded-xl bg-white px-4 py-3 ring-1 dark:bg-zinc-900 ${ringByAccent[accent]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${iconBg[accent]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Card conocimiento
// ============================================================

function CardConocimiento({
  entrada,
  onClick,
}: {
  entrada: EntradaConocimiento;
  onClick: () => void;
}) {
  const cat = entrada.categoria || "general";
  const activo = entrada.esta_activo !== false;
  const preview = entrada.contenido.trim().slice(0, 220);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorParaCategoria(cat)}`}
        >
          {cat}
        </span>
      </div>
      <h3 className="mb-1 truncate font-semibold tracking-tight">
        {entrada.titulo}
      </h3>
      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {preview}
        {entrada.contenido.length > 220 && "…"}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
            activo
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-zinc-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-zinc-400"}`}
          />
          {activo ? "Activo" : "Inactivo"}
        </span>
        <span className="text-[10px] text-zinc-500">
          {entrada.contenido.length} chars
        </span>
      </div>
    </button>
  );
}

// ============================================================
// Modal Guía
// ============================================================

function ModalGuia({ onCerrar }: { onCerrar: () => void }) {
  function descargar(p: (typeof PLANTILLAS)[0]) {
    const blob = new Blob([p.contenido], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.nombre}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            📖 Guía para Documentos
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600"
          >
            ×
          </button>
        </div>

        {/* Tips */}
        <div className="px-6 py-5">
          <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:from-violet-950/40 dark:to-indigo-950/40">
            <h3 className="mb-2 font-semibold">💡 Tips para mejores resultados</h3>
            <ul className="space-y-1.5 text-xs leading-relaxed">
              <li>
                <strong>✓ Párrafos separados:</strong> Usá líneas en blanco entre
                secciones para mejor procesamiento.
              </li>
              <li>
                <strong>✓ Información clara:</strong> Evitá jerga técnica; escribí
                como hablarías con un cliente.
              </li>
              <li>
                <strong>✓ Contexto completo:</strong> Incluí precios, horarios y
                datos de contacto actualizados.
              </li>
              <li>
                <strong>✓ Formato pregunta-respuesta:</strong> Ideal para FAQs;
                ayuda a que el agente encuentre respuestas rápido.
              </li>
            </ul>
          </div>

          {/* Plantillas */}
          <h3 className="mb-3 mt-5 text-sm font-semibold">
            ↓ Plantillas Descargables
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PLANTILLAS.map((p) => (
              <div
                key={p.nombre}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="mb-2 text-2xl">{p.icono}</div>
                <h4 className="font-semibold">{p.titulo}</h4>
                <p className="mt-1 text-xs text-zinc-500">{p.descripcion}</p>
                <button
                  type="button"
                  onClick={() => descargar(p)}
                  className="mt-3 w-full rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-violet-500/40 hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-violet-950/30"
                >
                  ↓ Descargar
                </button>
              </div>
            ))}
          </div>

          {/* Formatos */}
          <h3 className="mb-2 mt-5 text-sm font-semibold">Formatos soportados</h3>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mb-1 flex flex-wrap gap-2">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                .txt
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                .md
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                .pdf
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                .docx
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Recomendamos <code>.txt</code> o <code>.md</code> para mejores
              resultados. Los <code>.pdf</code> deben tener texto seleccionable
              (no escaneados como imagen). Tope de tamaño: 10MB.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/60 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal Buscar (probador de búsqueda local)
// ============================================================

function ModalBuscar({
  entradas,
  onCerrar,
}: {
  entradas: EntradaConocimiento[];
  onCerrar: () => void;
}) {
  const [query, setQuery] = useState("");

  // Match simple por palabras clave en título y contenido. No es vectorial.
  const resultados = useMemo(() => {
    if (!query.trim()) return [];
    const palabras = query
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 2);
    if (palabras.length === 0) return [];
    return entradas
      .map((e) => {
        const texto = `${e.titulo} ${e.contenido}`.toLowerCase();
        let matches = 0;
        for (const p of palabras) {
          if (texto.includes(p)) matches++;
        }
        const score = palabras.length > 0 ? matches / palabras.length : 0;
        return { entrada: e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [query, entradas]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            🔍 Probador de búsqueda
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="mb-3 text-xs text-zinc-500">
            Escribí lo que un cliente preguntaría. El agente busca en la base
            de conocimiento activa y mostramos qué documento(s) usaría como
            referencia.
          </p>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ej. ¿Cuánto cuesta el plan premium?"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <div className="mt-4 space-y-2">
            {!query.trim() ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Escribí una pregunta para ver coincidencias…
              </p>
            ) : resultados.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">
                Ningún documento matchea esa búsqueda.
              </p>
            ) : (
              resultados.map((r) => (
                <div
                  key={r.entrada.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-950/30"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorParaCategoria(r.entrada.categoria || "general")}`}
                    >
                      {r.entrada.categoria || "general"}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-violet-700 dark:text-violet-300">
                      {Math.round(r.score * 100)}% match
                    </span>
                  </div>
                  <p className="font-semibold">{r.entrada.titulo}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.entrada.contenido.slice(0, 160)}
                  </p>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 text-[10px] text-zinc-400">
            Búsqueda actual por palabras clave. La búsqueda vectorial semántica
            (que entiende sinónimos y contexto) viene en la próxima versión.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal Editor (crear / editar entrada)
// ============================================================

function ModalEditor({
  idCuenta,
  entrada,
  categoriasExistentes,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  entrada: EntradaConocimiento | null;
  categoriasExistentes: string[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState(entrada?.titulo ?? "");
  const [contenido, setContenido] = useState(entrada?.contenido ?? "");
  const [categoria, setCategoria] = useState(entrada?.categoria ?? "general");
  const [activo, setActivo] = useState(entrada?.esta_activo ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriasSugeridas = Array.from(
    new Set([...categoriasExistentes, "general", "productos", "precios", "faqs", "politicas", "casos_uso"]),
  );

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        titulo: titulo.trim(),
        contenido: contenido,
        categoria: categoria.trim() || "general",
        esta_activo: activo,
      };
      const url = entrada
        ? `/api/cuentas/${idCuenta}/conocimiento/${entrada.id}`
        : `/api/cuentas/${idCuenta}/conocimiento`;
      const metodo = entrada ? "PATCH" : "POST";
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!entrada) return;
    if (!confirm("¿Borrar este documento? Esta acción no se puede deshacer.")) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conocimiento/${entrada.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            {entrada ? "Editar Documento" : "Nuevo Documento"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-4 px-6 py-5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Título del documento *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="ej. Información general del negocio"
              required
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Categoría
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) =>
                  setCategoria(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]+/g, "_"),
                  )
                }
                list="categorias-sugeridas"
                placeholder="ej. productos"
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <datalist id="categorias-sugeridas">
                {categoriasSugeridas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium">Activo (visible para IA)</span>
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Contenido *
              </label>
              <span className="text-[10px] text-zinc-500">
                {contenido.length} caracteres
              </span>
            </div>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={14}
              placeholder="Escribí o pegá la información que querés que la IA conozca…"
              className="mt-1 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Usá texto claro y estructurado. Podés incluir preguntas y
              respuestas, listas o descripciones detalladas.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {entrada ? (
              <button
                type="button"
                onClick={borrar}
                disabled={guardando}
                className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Borrar documento
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCerrar}
                disabled={guardando}
                className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || !titulo.trim()}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar Documento"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
