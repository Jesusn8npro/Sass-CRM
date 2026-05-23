import type { Metadata } from "next";
import { ServicioTemplate, type ServicioConfig } from "@/components/ServicioTemplate";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Prospección Inteligente con IA — INYECTAIA",
  description:
    "Decile a la IA qué tipo de negocio buscás y en qué ciudad. En segundos tenés una lista de leads con teléfono, email y web. Listos para contactar.",
  alternates: { canonical: urlAbsoluta("/servicios/prospeccion") },
  openGraph: { title: "Prospección Inteligente con IA — INYECTAIA", siteName: "INYECTAIA" },
};

const CONFIG: ServicioConfig = {
  accentHex: "#e879f9",
  accentRgb: "232,121,249",
  badge: "Nuevo — Powered by Apify",
  crumb: "Prospección Inteligente",
  h1: ["Decile qué leads querés.", "En 60 segundos", " los tenés."],
  description:
    "Escribís el tipo de negocio y la ciudad. La IA devuelve una lista de leads con teléfono, email y web. Sin LinkedIn, sin hojas de cálculo, sin freelancers.",
  btnPrimary: "Buscar mis primeros leads",
  btnSecondary: "Ver demo →",
  featureLabel: "// cómo funciona",
  h2Features: ["Del texto al lead", "en segundos", "."],
  metrics: [
    { v: "< 60s",  l: "para tener tu lista de leads", d: "de búsqueda a datos completos" },
    { v: "3 datos", l: "por lead mínimo",              d: "teléfono, email y web" },
    { v: "∞",      l: "búsquedas por mes",             d: "sin límite en el plan Pro" },
    { v: "0 min",  l: "de prospección manual",         d: "la IA raspa, vos contactás" },
  ],
  features: [
    { n: "01", t: "Búsqueda en lenguaje natural",  d: "Escribís «dentistas en Montevideo» o «agencias de viaje en Guadalajara». La IA entiende y devuelve los resultados." },
    { n: "02", t: "Datos completos: tel + email + web", d: "Cada lead llega con teléfono, email, sitio web, dirección y redes sociales. Listo para contactar por WhatsApp, llamada o email." },
    { n: "03", t: "Listados exportables",           d: "Bajás los leads a CSV, los importás al pipeline, o dejás que el agente los contacte automáticamente por WhatsApp." },
    { n: "04", t: "Deduplicación automática",       d: "La IA detecta duplicados y los filtra. No perdés tiempo contactando al mismo negocio dos veces." },
    { n: "05", t: "Calificación por IA",            d: "Podés pedirle a la IA que priorice según criterios: tamaño, reviews, presencia digital. Los mejores leads primero." },
    { n: "06", t: "Integración directa al pipeline", d: "Los leads van directo al pipeline Kanban. El agente WhatsApp empieza a contactarlos automáticamente en el mismo flujo." },
  ],
  ctaH2: ["Más leads en un día", "que en un mes prospectando a mano", "."],
  ctaBody:
    "Probalo gratis. Sin tarjeta. Buscá tus primeros 50 leads y mirá cuántos terminan siendo clientes.",
  ctaPrimary: "Empezar gratis",
};

export default function PaginaProspeccion() {
  return <ServicioTemplate c={CONFIG} />;
}
