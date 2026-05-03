"use client";

import { useState } from "react";
import type { EntradaConocimiento } from "@/lib/baseDatos";

export function ModalEditor({
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
