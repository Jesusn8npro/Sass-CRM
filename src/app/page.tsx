import { Navegacion, PieDePagina } from "./_componentes-landing/Layout";
import {
  CasosDeUso,
  ComoFunciona,
  Funciones,
  Hero,
  Metricas,
} from "./_componentes-landing/Secciones";
import {
  CtaFinal,
  Precios,
  PreguntasFrecuentes,
} from "./_componentes-landing/Comercial";

/**
 * Landing pública.
 * Server component puro: sin estado, sin JS extra, máximo SEO.
 * Estructura: Nav · Hero · Métricas · Cómo funciona · Funciones ·
 * Casos de uso · Precios · FAQ · CTA final · Footer.
 */
export default function PaginaLanding() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <Navegacion />
      <Hero />
      <Metricas />
      <ComoFunciona />
      <Funciones />
      <CasosDeUso />
      <Precios />
      <PreguntasFrecuentes />
      <CtaFinal />
      <PieDePagina />
    </main>
  );
}
