/**
 * Crear artículo manual (sin IA). Form simple POST a /api/admin/blog/articulos.
 * Útil cuando vos querés escribir tu propio post desde cero.
 */
import { listarCategorias } from "@/lib/baseDatos";
import { FormularioManual } from "./FormularioManual";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoArticuloManual() {
  const categorias = await listarCategorias();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Escribir artículo manual</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Si preferís escribir vos directamente sin pasar por IA. Quedará como
          borrador hasta que lo publiques.
        </p>
      </div>
      <FormularioManual
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />
    </div>
  );
}
