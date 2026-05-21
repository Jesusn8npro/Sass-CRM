import Link from "next/link";
import { requerirAdmin } from "@/lib/auth/sesion";
import { redirect } from "next/navigation";
import { obtenerBlogConfig } from "@/lib/db/blogConfig";
import { ConfiguracionBlogClient } from "./ConfiguracionBlogClient";

export const dynamic = "force-dynamic";

export default async function PaginaConfiguracionBlog() {
  const auth = await requerirAdmin();
  if (auth instanceof Response) redirect("/app/login");

  const config = await obtenerBlogConfig();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // blog → automatización
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
              Configuración automática
            </h1>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Horario y calidad de generación con IA
            </p>
          </div>
          <Link
            href="/app/admin/blog"
            className="rounded-full border border-zinc-200 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-700 transition-colors hover:border-zinc-400 dark:border-white/15 dark:text-white/70 dark:hover:border-white/30"
          >
            ← Volver al blog
          </Link>
        </div>
      </header>

      <ConfiguracionBlogClient configInicial={config} />
    </div>
  );
}
