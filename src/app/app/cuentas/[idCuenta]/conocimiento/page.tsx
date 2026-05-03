"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { EntradaConocimiento } from "@/lib/baseDatos";

interface RespuestaConocimiento {
  entradas: EntradaConocimiento[];
}

/**
 * Página /conocimiento — base de conocimiento del agente.
 *
 * El bot lee estas entradas y las inyecta en el system prompt para
 * que pueda responder preguntas con info específica del negocio
 * (FAQ, políticas, info de productos, etc.).
 */
export default function PaginaConocimiento() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [entradas, setEntradas] = useState<EntradaConocimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tituloNuevo, setTituloNuevo] = useState("");
  const [contenidoNuevo, setContenidoNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!tituloNuevo.trim() || !contenidoNuevo.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conocimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: tituloNuevo.trim(),
          contenido: contenidoNuevo.trim(),
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error creando");
        return;
      }
      setTituloNuevo("");
      setContenidoNuevo("");
      await cargar();
    } finally {
      setCreando(false);
    }
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta entrada de conocimiento?")) return;
    await fetch(`/api/cuentas/${idCuenta}/conocimiento/${id}`, {
      method: "DELETE",
    });
    await cargar();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          Configuración
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Base de conocimiento
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">
          El agente lee estas entradas y las usa para responder con
          información específica de tu negocio (FAQ, políticas, casos
          de uso, info de productos que no entran en el catálogo, etc.).
        </p>
      </header>

      {/* Form crear */}
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Agregar entrada nueva</h2>
        <form onSubmit={crear} className="space-y-3">
          <input
            type="text"
            value={tituloNuevo}
            onChange={(e) => setTituloNuevo(e.target.value)}
            placeholder="Título (ej: Política de devoluciones, Horarios de atención)"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <textarea
            value={contenidoNuevo}
            onChange={(e) => setContenidoNuevo(e.target.value)}
            placeholder="Contenido — todo lo que el agente tiene que saber sobre este tema. Cuanto más detallado, mejor."
            rows={5}
            className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={
              !tituloNuevo.trim() || !contenidoNuevo.trim() || creando
            }
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-50"
          >
            {creando ? "Guardando…" : "+ Agregar"}
          </button>
        </form>
      </section>

      {/* Lista */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Entradas {entradas.length > 0 ? `(${entradas.length})` : ""}
        </h2>
        {cargando ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : entradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-semibold">
              No hay entradas todavía
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Agregá tu primera entrada arriba para que el agente sepa
              responder con info de tu negocio.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {entradas.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{e.titulo}</h3>
                  <button
                    type="button"
                    onClick={() => borrar(e.id)}
                    className="text-[11px] text-zinc-400 hover:text-red-600"
                  >
                    Borrar
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {e.contenido}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
