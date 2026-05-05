import { notFound } from "next/navigation";
import Link from "next/link";
import { Navegacion, PieDePagina } from "../../_componentes-landing/Layout";
import { obtenerPlantillaIndustria } from "@/lib/plantillas-industria";
import { ChatDemo } from "./_componentes/ChatDemo";

interface Props {
  params: Promise<{ idIndustria: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { idIndustria } = await params;
  const p = obtenerPlantillaIndustria(idIndustria);
  if (!p) return { title: "Demo no encontrado" };
  return {
    title: `Demo: agente para ${p.nombre}`,
    description: `Conversá en vivo con ${p.agente_nombre_default}, agente IA de ${p.nombre.toLowerCase()}.`,
  };
}

/**
 * /demo/[idIndustria] — Server wrapper. Verifica que la industria
 * exista y entrega los datos al client component que maneja el chat.
 */
export default async function PaginaDemoIndustria({ params }: Props) {
  const { idIndustria } = await params;
  const plantilla = obtenerPlantillaIndustria(idIndustria);
  if (!plantilla) notFound();

  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
      <Navegacion />

      <section className="border-b border-white/[0.06] bg-black">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50 hover:text-white/80"
            >
              ← Cambiar industria
            </Link>
          </div>
          <Link
            href="/signup"
            className="hidden rounded-full bg-emerald-400 px-4 py-1.5 text-[12px] font-semibold text-black hover:bg-emerald-300 sm:inline-flex"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center gap-4">
          <span className="text-5xl">{plantilla.emoji}</span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // demo en vivo
            </p>
            <h1 className="font-display text-3xl italic leading-tight tracking-tight text-white sm:text-4xl">
              {plantilla.nombre}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              Hablás con {plantilla.agente_nombre_default} —{" "}
              {plantilla.agente_rol_default.toLowerCase()}
            </p>
          </div>
        </div>

        <ChatDemo
          idIndustria={plantilla.id}
          nombreAgente={plantilla.agente_nombre_default}
          mensajeBienvenida={plantilla.mensaje_bienvenida}
        />

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
          Demo público · sin persistencia · 20 mensajes / 5 min
        </p>
      </section>

      <PieDePagina />
    </main>
  );
}
