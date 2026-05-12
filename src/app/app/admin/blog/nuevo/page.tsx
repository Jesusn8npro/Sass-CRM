import { listarCategorias } from "@/lib/baseDatos";
import { FormularioGenerar } from "./FormularioGenerar";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoArticulo() {
  const categorias = await listarCategorias();
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // blog · nuevo
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Generar artículo con IA
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-white/55">
          La IA escribe 1500-3000 palabras SEO-optimizadas y opcionalmente
          genera la imagen de portada. Tarda 1-2 min. Queda como borrador
          hasta que lo publiques.
        </p>
      </header>
      <FormularioGenerar
        categorias={categorias.map((c) => ({
          id: c.id,
          slug: c.slug,
          nombre: c.nombre,
        }))}
      />
    </div>
  );
}
