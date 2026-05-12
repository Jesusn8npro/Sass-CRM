import Link from "next/link";
import {
  listarTodosLosArticulos,
  type ArticuloConCategoria,
  type EstadoArticulo,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<
  EstadoArticulo,
  { label: string; clase: string }
> = {
  borrador: {
    label: "borrador",
    clase: "text-amber-600 dark:text-amber-300",
  },
  publicado: {
    label: "publicado",
    clase: "text-emerald-600 dark:text-emerald-300",
  },
  archivado: {
    label: "archivado",
    clase: "text-zinc-500 dark:text-white/40",
  },
};

export default async function PaginaAdminBlog({
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
    <div className="mx-auto max-w-6xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // blog
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
              Artículos del blog
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              {articulos.length} {estado ? `· ${estado}` : "totales"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/app/admin/blog/nuevo"
              className="rounded-full bg-emerald-600 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-emerald-700"
            >
              ✨ Generar con IA
            </Link>
            <Link
              href="/app/admin/blog/manual"
              className="rounded-full border border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-400 dark:border-white/15 dark:text-white/70 dark:hover:border-white/30"
            >
              ✍ Manual
            </Link>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <nav className="mb-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
        <FiltroEstado activo={!estado} label="todos" href="/app/admin/blog" />
        <FiltroEstado
          activo={estado === "borrador"}
          label="borradores"
          href="/app/admin/blog?estado=borrador"
        />
        <FiltroEstado
          activo={estado === "publicado"}
          label="publicados"
          href="/app/admin/blog?estado=publicado"
        />
        <FiltroEstado
          activo={estado === "archivado"}
          label="archivados"
          href="/app/admin/blog?estado=archivado"
        />
      </nav>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3 text-right">Lecturas</th>
              <th className="px-4 py-3">Editado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {articulos.map((a) => (
              <FilaArticulo key={a.id} articulo={a} />
            ))}
            {articulos.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/35"
                >
                  sin artículos en esta vista
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FiltroEstado({
  activo,
  label,
  href,
}: {
  activo: boolean;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 transition-colors ${
        activo
          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/[0.08] dark:text-emerald-300"
          : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-white/[0.06] dark:text-white/55 dark:hover:border-white/20"
      }`}
    >
      {label}
    </Link>
  );
}

function FilaArticulo({ articulo }: { articulo: ArticuloConCategoria }) {
  const e = ETIQUETA_ESTADO[articulo.estado];
  return (
    <tr className="border-t border-zinc-100 dark:border-white/[0.04]">
      <td className="px-4 py-3">
        <div className="font-medium text-zinc-900 dark:text-white">
          {articulo.titulo}
        </div>
        <div className="font-mono text-[10px] text-zinc-400 dark:text-white/35">
          /{articulo.slug}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-white/55">
        {articulo.categoria_nombre ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${e.clase}`}
        >
          {e.label}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
        {articulo.generado_por === "ia"
          ? "🤖 ia"
          : articulo.generado_por === "mixto"
            ? "🤝 mixto"
            : "✍ humano"}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-600 dark:text-white/70">
        {articulo.visualizaciones}
      </td>
      <td className="px-4 py-3 font-mono text-[10px] text-zinc-400 dark:text-white/35">
        {new Date(articulo.actualizado_en).toLocaleDateString("es")}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/app/admin/blog/${articulo.id}`}
          className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 hover:text-emerald-700 dark:text-emerald-300"
        >
          editar →
        </Link>
      </td>
    </tr>
  );
}
