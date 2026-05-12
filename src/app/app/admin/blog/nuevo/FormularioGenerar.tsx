"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Categoria {
  id: string;
  slug: string;
  nombre: string;
}

export function FormularioGenerar({
  categorias,
}: {
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tema, setTema] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [longitud, setLongitud] = useState<"corto" | "medio" | "largo">(
    "medio",
  );
  const [modoImagenes, setModoImagenes] = useState<
    "auto" | "solo-portada" | "completo" | "sin-imagenes"
  >("auto");
  const [tierPortada, setTierPortada] = useState<"estandar" | "pro">(
    "estandar",
  );
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tema.trim().length < 5) {
      setError("El tema es muy corto");
      return;
    }
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/blog/generar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tema: tema.trim(),
            categoria: categoria || undefined,
            longitud,
            modo_imagenes: modoImagenes,
            tier_portada: tierPortada,
            generar_imagen: modoImagenes !== "sin-imagenes",
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setError(j?.error || `HTTP ${r.status}`);
          return;
        }
        const j = await r.json();
        if (!j.articulo?.id) {
          setError("Respuesta inesperada del servidor");
          return;
        }
        router.push(`/app/admin/blog/${j.articulo.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <Bloque etiqueta="// tema *">
        <textarea
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          rows={3}
          required
          placeholder="Cómo usar WhatsApp Business API para automatizar atención al cliente en un e-commerce"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white dark:placeholder:text-white/30"
        />
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
          cuanto más específico, mejor el resultado
        </p>
      </Bloque>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bloque etiqueta="// categoría">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white"
          >
            <option value="">— sin categoría —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Bloque>

        <Bloque etiqueta="// longitud">
          <select
            value={longitud}
            onChange={(e) => setLongitud(e.target.value as typeof longitud)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white"
          >
            <option value="corto">Corto · ~1200 palabras</option>
            <option value="medio">Medio · ~2000 palabras</option>
            <option value="largo">Largo · ~3000 palabras</option>
          </select>
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Bloque etiqueta="// modo imágenes">
          <select
            value={modoImagenes}
            onChange={(e) =>
              setModoImagenes(e.target.value as typeof modoImagenes)
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white"
          >
            <option value="auto">Auto · portada + inlines según largo</option>
            <option value="solo-portada">Solo portada · más económico</option>
            <option value="completo">Completo · portada + 2 inline</option>
            <option value="sin-imagenes">Sin imágenes · testing</option>
          </select>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
            auto: 0 inline si &lt;1500 palabras, 1 si 1500-2500, 2 si más
          </p>
        </Bloque>

        <Bloque etiqueta="// tier portada">
          <select
            value={tierPortada}
            onChange={(e) =>
              setTierPortada(e.target.value as typeof tierPortada)
            }
            disabled={modoImagenes === "sin-imagenes"}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-white"
          >
            <option value="estandar">Estándar · Nano Banana 2 (~$0.04)</option>
            <option value="pro">Pro · texto renderizado (~$0.13)</option>
          </select>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
            pro solo conviene para portadas con texto / layouts complejos
          </p>
        </Bloque>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-emerald-600 px-6 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "generando… 1-2 min" : "✨ generar artículo"}
        </button>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
        el artículo queda como borrador — vos revisás y publicás manualmente
      </p>
    </form>
  );
}

function Bloque({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
        {etiqueta}
      </p>
      {children}
    </div>
  );
}
