"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { EntradaConocimiento } from "@/lib/baseDatos";
import { CardConocimiento, StatCard } from "./_componentes/compartido";
import { ModalBuscar, ModalGuia } from "./_componentes/Modales";
import { ModalEditor } from "./_componentes/Editor";

interface RespuestaConocimiento {
  entradas: EntradaConocimiento[];
}

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
