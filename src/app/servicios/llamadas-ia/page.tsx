import type { Metadata } from "next";
import { ServicioTemplate, type ServicioConfig } from "@/components/ServicioTemplate";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const metadata: Metadata = {
  title: "Llamadas con Voz IA — INYECTAIA",
  description:
    "Clonamos tu voz con ElevenLabs. Tu agente llama leads automáticamente usando Vapi. El cliente siente que sos vos al teléfono. 100% automatizado.",
  alternates: { canonical: urlAbsoluta("/servicios/llamadas-ia") },
  openGraph: { title: "Llamadas con Voz IA — INYECTAIA", siteName: "INYECTAIA" },
};

const CONFIG: ServicioConfig = {
  accentHex: "#a78bfa",
  accentRgb: "167,139,250",
  badge: "Nuevo — ElevenLabs + Vapi",
  crumb: "Llamadas con Voz IA",
  h1: ["Tu voz llama a", "tus leads", ". Vos estás durmiendo."],
  description:
    "Clonamos tu voz. Tu agente llama a todos tus prospectos de forma automática, conduce la conversación y documenta el resultado. El cliente cree que sos vos.",
  btnPrimary: "Clonar mi voz gratis",
  btnSecondary: "Escuchar demo →",
  featureLabel: "// tecnología",
  h2Features: ["Cómo funciona la", "voz clonada", "."],
  metrics: [
    { v: "3min", l: "para clonar tu voz",        d: "basta con una grabación de audio" },
    { v: "∞",    l: "llamadas simultáneas",       d: "el agente nunca se cansa de marcar" },
    { v: "100%", l: "transcripción automática",   d: "sin tomar notas ni escuchar audios" },
    { v: "0%",   l: "detectado como robot",       d: "voz natural, conversación fluida" },
  ],
  features: [
    { n: "01", t: "Clonación de voz con ElevenLabs",    d: "Grabás 3 minutos de audio. ElevenLabs clona tu voz con fidelidad casi perfecta. El agente llama con esa voz. El cliente cree que sos vos." },
    { n: "02", t: "Llamadas automáticas con Vapi",       d: "El agente marca el número, espera que atienda, conduce la conversación y registra el resultado. Sin que vos hagas nada." },
    { n: "03", t: "Transcripción y resumen automático",  d: "Cada llamada se transcribe, se resume y se guarda en el perfil del lead. Leés en 10 segundos qué pasó sin escuchar el audio." },
    { n: "04", t: "Scripts inteligentes y dinámicos",    d: "El agente adapta el guión según las respuestas del cliente. Si dice 'no me interesa', tiene un manejo específico. Si pide precio, responde con tu catálogo." },
    { n: "05", t: "Horarios y frecuencia configurables", d: "Programás qué días y en qué horarios llama. Cuántos intentos hace por lead. Qué tiempo espera entre llamadas." },
    { n: "06", t: "Integración directa al pipeline",     d: "El resultado de cada llamada (interesado, no contesta, rechazó) mueve el lead automáticamente en el pipeline Kanban." },
  ],
  ctaH2: ["Imaginate llamar a 200 leads", "mientras desayunás", "."],
  ctaBody:
    "Con tu voz clonada, tu agente hace llamadas en paralelo, registra respuestas y mueve leads. Vos revisás los resultados con el café.",
  ctaPrimary: "Activar llamadas IA",
};

export default function PaginaLlamadasIA() {
  return <ServicioTemplate c={CONFIG} />;
}
