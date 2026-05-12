import { listarCategorias } from "@/lib/baseDatos";
import { FormularioGenerar } from "./FormularioGenerar";

export const dynamic = "force-dynamic";

export default async function PaginaNuevoArticulo() {
  const categorias = await listarCategorias();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Generar artículo con IA</h2>
        <p className="text-sm text-zinc-500 mt-1">
          La IA escribe un artículo SEO-optimizado de 1500-3000 palabras y opcionalmente genera una imagen de portada. Tardá 1-2 min.
        </p>
      </div>
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
