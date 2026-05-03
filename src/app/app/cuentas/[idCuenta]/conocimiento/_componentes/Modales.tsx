"use client";

import { useMemo, useState } from "react";
import type { EntradaConocimiento } from "@/lib/baseDatos";
import { PLANTILLAS, colorParaCategoria } from "./compartido";

export function ModalGuia({ onCerrar }: { onCerrar: () => void }) {
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

export function ModalBuscar({
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
