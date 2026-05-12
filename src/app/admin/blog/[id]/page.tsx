import { notFound } from "next/navigation";
import { listarCategorias, obtenerArticuloPorId } from "@/lib/baseDatos";
import { EditorArticulo } from "./EditorArticulo";

export const dynamic = "force-dynamic";

export default async function PaginaEditorArticulo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [articulo, categorias] = await Promise.all([
    obtenerArticuloPorId(id),
    listarCategorias(),
  ]);
  if (!articulo) notFound();

  return (
    <EditorArticulo
      articulo={{
        id: articulo.id,
        slug: articulo.slug,
        titulo: articulo.titulo,
        resumen: articulo.resumen,
        contenido_md: articulo.contenido_md,
        imagen_portada_url: articulo.imagen_portada_url,
        imagen_portada_alt: articulo.imagen_portada_alt,
        categoria_id: articulo.categoria_id,
        estado: articulo.estado,
        seo_titulo: articulo.seo_titulo,
        seo_descripcion: articulo.seo_descripcion,
        seo_keywords: articulo.seo_keywords,
      }}
      categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
    />
  );
}
