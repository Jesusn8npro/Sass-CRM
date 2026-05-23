import type { Metadata } from "next";
import { ServicioTemplate, type ServicioConfig } from "@/components/ServicioTemplate";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Automatización de Ventas con IA — INYECTAIA",
  description:
    "Pipeline Kanban inteligente donde la IA mueve los leads automáticamente según su comportamiento. Scoring de prospectos, seguimientos automáticos y reportes en tiempo real.",
  alternates: { canonical: urlAbsoluta("/servicios/automatizacion") },
  openGraph: { title: "Automatización de Ventas con IA — INYECTAIA", siteName: "INYECTAIA" },
};

const CONFIG: ServicioConfig = {
  accentHex: "#2dd4bf",
  accentRgb: "45,212,191",
  crumb: "Automatización de Ventas",
  h1: ["Tu pipeline vende", "solo", " mientras vos dormís."],
  description:
    "Pipeline Kanban donde la IA mueve leads, manda seguimientos y califica prospectos. Vos aparecés solo cuando hay que cerrar.",
  btnPrimary: "Automatizar mis ventas",
  btnSecondary: "Ver demo →",
  featureLabel: "// pipeline inteligente",
  h2Features: ["Todo lo que el pipeline", "hace por vos", "."],
  metrics: [
    { v: "3×",   l: "más leads contactados", d: "vs. proceso manual" },
    { v: "0h",   l: "de seguimiento manual", d: "la IA lo hace sola" },
    { v: "100%", l: "leads documentados",    d: "sin que nada caiga al vacío" },
    { v: "360°", l: "vista del cliente",     d: "chat + datos + historial" },
  ],
  features: [
    { n: "01", t: "Pipeline Kanban con IA",        d: "La IA mueve los leads entre etapas según su comportamiento: si respondió, si agendó, si pidió precio. Sin que vos toques nada." },
    { n: "02", t: "Scoring automático de leads",   d: "Cada lead recibe un puntaje según qué tan listo está para comprar. Ves primero los más calientes y no perdés tiempo en fríos." },
    { n: "03", t: "Seguimientos automáticos",      d: "Si un lead no respondió en X horas, el agente manda un follow-up personalizado. El ritmo lo configurás vos." },
    { n: "04", t: "Historial completo en cada tarjeta", d: "Cada tarjeta del pipeline tiene el chat completo, los datos del cliente y el resumen de la IA. Sin buscar en WhatsApp." },
    { n: "05", t: "Etapas personalizadas",         d: "Contactado, Interesado, Cotizado, Cerrado, Perdido. O las etapas que vos quieras para tu proceso de ventas." },
    { n: "06", t: "Notificaciones en tiempo real", d: "Cuando un lead llega a una etapa clave, recibís notificación. Entrás, leés el contexto, cerrás la venta." },
  ],
  ctaH2: ["Dejá de perseguir leads.", "Dejá que la IA los persiga por vos.", ""],
  ctaBody:
    "Pipeline activo desde el día 1. Sin contratar vendedores, sin configurar Zapier, sin perder leads en el chat.",
  ctaPrimary: "Crear pipeline gratis",
};

export default function PaginaAutomatizacion() {
  return <ServicioTemplate c={CONFIG} />;
}
