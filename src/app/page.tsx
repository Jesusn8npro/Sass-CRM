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
 * Landing pública. Server component puro: dark editorial cyber.
 * Forza fondo negro independiente del tema global de la app.
 */
export default function PaginaLanding() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
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
