import { listarCategorias } from "@/lib/baseDatos";
import { FormularioManual } from "./FormularioManual";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoArticuloManual() {
  const categorias = await listarCategorias();
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // blog · manual
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Escribir artículo manual
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-white/55">
          Sin IA, vos escribís. Queda como borrador hasta publicar.
        </p>
      </header>
      <FormularioManual
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />
    </div>
  );
}
