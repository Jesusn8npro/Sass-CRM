import type { Metadata } from "next";
import { ServicioTemplate, type ServicioConfig } from "@/components/ServicioTemplate";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Análisis & Reportes con IA — INYECTAIA",
  description:
    "Métricas en tiempo real de tus conversaciones, leads convertidos e ingresos generados. Sin exportar Excel, sin dashboards complicados.",
  alternates: { canonical: urlAbsoluta("/servicios/analisis") },
  openGraph: { title: "Análisis & Reportes con IA — INYECTAIA", siteName: "INYECTAIA" },
};

const CONFIG: ServicioConfig = {
  accentHex: "#fbbf24",
  accentRgb: "251,191,36",
  crumb: "Análisis & Reportes",
  h1: ["Sabé exactamente", "cuánto", " está vendiendo tu IA."],
  description:
    "Dashboard en tiempo real con métricas de conversación, performance del agente y tasa de conversión por etapa. Sin Excel, sin reportes manuales.",
  btnPrimary: "Ver mi dashboard",
  btnSecondary: "Ver demo →",
  featureLabel: "// métricas",
  h2Features: ["Datos que", "mueven negocios", "."],
  metrics: [
    { v: "RT",   l: "tiempo real",       d: "datos actualizados al instante" },
    { v: "360°", l: "visibilidad total", d: "desde el primer mensaje al cierre" },
    { v: "0h",   l: "de reporting manual", d: "la IA genera los reportes sola" },
    { v: "∞",    l: "historial guardado", d: "cada conversación, para siempre" },
  ],
  features: [
    { n: "01", t: "Dashboard en tiempo real",      d: "Conversaciones activas, leads nuevos, citas agendadas e ingresos estimados. Todo en una pantalla, actualizado al instante." },
    { n: "02", t: "Performance del agente IA",     d: "Cuántos mensajes respondió, en cuántos segundos, cuántos leads calificó. Sabés exactamente qué tan bien está trabajando tu agente." },
    { n: "03", t: "Tasa de conversión por etapa",  d: "Ves en qué punto del funnel se pierden tus leads. ¿En el primer mensaje? ¿Al pedir precio? Optimizás con datos, no con intuición." },
    { n: "04", t: "Reportes automáticos por email", d: "Cada semana o cada mes, recibís un resumen de cómo fue tu negocio. Sin entrar al panel, sin armar informes." },
    { n: "05", t: "Análisis de sentimiento",       d: "La IA clasifica las conversaciones por emoción del cliente: positivo, neutro, negativo. Detectás fricciones antes de que se conviertan en cancelaciones." },
    { n: "06", t: "Exportación flexible",          d: "Bajás cualquier reporte a CSV o PDF. Compartís con tu equipo o contador sin darles acceso a toda la plataforma." },
  ],
  ctaH2: ["Lo que no se mide", "no mejora", ". Y INYECTAIA mide todo."],
  ctaBody:
    "Activá el dashboard y en 24 horas ya tenés datos reales sobre tu proceso de ventas. Sin configurar nada.",
  ctaPrimary: "Empezar gratis",
};

export default function PaginaAnalisis() {
  return <ServicioTemplate c={CONFIG} />;
}
