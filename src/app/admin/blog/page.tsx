import Link from "next/link";
import {
  listarTodosLosArticulos,
  type ArticuloConCategoria,
  type EstadoArticulo,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<EstadoArticulo, { label: string; color: string }> = {
  borrador: { label: "Borrador", color: "bg-amber-100 text-amber-800" },
  publicado: { label: "Publicado", color: "bg-emerald-100 text-emerald-800" },
  archivado: { label: "Archivado", color: "bg-zinc-100 text-zinc-600" },
};

export default async function PaginaBlogAdmin({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const params = await searchParams;
  const estado =
    params.estado === "borrador" ||
    params.estado === "publicado" ||
    params.estado === "archivado"
      ? params.estado
      : undefined;
  const articulos = await listarTodosLosArticulos({ estado, limite: 200 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Blog</h2>
          <p className="text-sm text-zinc-500">
            {articulos.length} artículos {estado ? `(${estado})` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/blog/nuevo"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            ✨ Generar con IA
          </Link>
          <Link
            href="/admin/blog/manual"
            className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700"
          >
            ✍ Escribir manual
          </Link>
        </div>
      </div>

      {/* Filtros estado */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/blog"
          className={`px-3 py-1 rounded-full text-xs ${!estado ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"}`}
        >
          Todos
        </Link>
        <Link
          href="/admin/blog?estado=borrador"
          className={`px-3 py-1 rounded-full text-xs ${estado === "borrador" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800"}`}
        >
          Borradores
        </Link>
        <Link
          href="/admin/blog?estado=publicado"
          className={`px-3 py-1 rounded-full text-xs ${estado === "publicado" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"}`}
        >
          Publicados
        </Link>
        <Link
          href="/admin/blog?estado=archivado"
          className={`px-3 py-1 rounded-full text-xs ${estado === "archivado" ? "bg-zinc-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
        >
          Archivados
        </Link>
      </div>

      <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Título</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Origen</th>
              <th className="px-4 py-2 font-medium text-center">Lecturas</th>
              <th className="px-4 py-2 font-medium">Última edición</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {articulos.map((a) => (
              <FilaArticulo key={a.id} articulo={a} />
            ))}
            {articulos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No hay artículos en esta vista.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaArticulo({ articulo }: { articulo: ArticuloConCategoria }) {
  const e = ETIQUETA_ESTADO[articulo.estado];
  return (
    <tr className="border-t">
      <td className="px-4 py-2">
        <div className="font-medium">{articulo.titulo}</div>
        <div className="text-xs text-zinc-500 font-mono">/{articulo.slug}</div>
      </td>
      <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
        {articulo.categoria_nombre ?? "—"}
      </td>
      <td className="px-4 py-2">
        <span className={`px-2 py-0.5 rounded-full text-xs ${e.color}`}>
          {e.label}
        </span>
      </td>
      <td className="px-4 py-2 text-xs">
        {articulo.generado_por === "ia"
          ? "🤖 IA"
          : articulo.generado_por === "mixto"
            ? "🤝 Mixto"
            : "✍ Humano"}
      </td>
      <td className="px-4 py-2 text-center">{articulo.visualizaciones}</td>
      <td className="px-4 py-2 text-xs text-zinc-500">
        {new Date(articulo.actualizado_en).toLocaleString("es")}
      </td>
      <td className="px-4 py-2 text-right">
        <Link
          href={`/admin/blog/${articulo.id}`}
          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
        >
          Editar →
        </Link>
      </td>
    </tr>
  );
}
