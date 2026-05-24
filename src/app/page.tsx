import type { Metadata } from "next";
import { Navegacion, PieDePagina, BotoneFlotanteWhatsApp } from "./_componentes-landing/Layout";
import { Hero } from "./_componentes-landing/HeroSection";
import {
  CasosDeUso,
  ComoFunciona,
  Demo,
  Funciones,
  Metricas,
  VideoSection,
  BlogSection,
} from "./_componentes-landing/Secciones";
import { listarArticulosPublicados } from "@/lib/baseDatos";
import {
  CtaFinal,
  Precios,
  PreguntasFrecuentes,
} from "./_componentes-landing/Comercial";
import { LogosClientes } from "./_componentes-landing/LogosClientes";
import { TestimoniosSociales } from "./_componentes-landing/TestimoniosSociales";
import { BotonLlamadaVapi } from "./_componentes-landing/LlamadaVapi";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

const TITULO = "INYECTAIA — Agentes de IA para WhatsApp, Ventas y Automatización";
const DESCRIPCION =
  "Inyectamos IA en tu negocio: agentes WhatsApp que venden 24/7, llamadas con voz clonada, prospección automática y pipeline inteligente. Sin código. Resultados desde el día 1.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  keywords: [
    "inyectaia",
    "agentes ia whatsapp",
    "automatizar whatsapp business",
    "chatbot whatsapp pymes",
    "crm ia whatsapp",
    "ventas automaticas ia",
    "bot whatsapp colombia",
    "bot whatsapp argentina",
    "bot whatsapp mexico",
    "automatizacion ia latam",
    "llamadas ia voz clonada",
    "prospeccion automatica ia",
    "pipeline ventas ia",
    "inteligencia artificial negocios",
  ],
  alternates: { canonical: urlAbsoluta("/") },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: urlAbsoluta("/"),
    type: "website",
    locale: "es_419",
    siteName: "INYECTAIA",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Qué es INYECTAIA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "INYECTAIA es una plataforma que inyecta inteligencia artificial en tu negocio: agentes WhatsApp que venden 24/7, llamadas con voz clonada, prospección automática y pipeline de ventas inteligente.",
      },
    },
    {
      "@type": "Question",
      name: "¿Necesito saber programar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Todo desde el panel: catálogo, prompt en lenguaje natural, integraciones pegando keys. Cero código.",
      },
    },
    {
      "@type": "Question",
      name: "¿Esto banea mi WhatsApp?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Usamos WhatsApp Web con límites diarios, jitter humano y respeto de horarios. Diseñado para no quemar números.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cuánto tarda el setup?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "2 minutos crear cuenta + escanear QR. 30 minutos configurar el agente IA. Vendiendo el mismo día.",
      },
    },
  ],
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "INYECTAIA",
  url: urlAbsoluta("/"),
  description: DESCRIPCION,
  foundingLocation: { "@type": "Place", name: "LATAM" },
  sameAs: [],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "INYECTAIA",
  url: urlAbsoluta("/"),
  inLanguage: "es",
  potentialAction: {
    "@type": "SearchAction",
    target: `${urlAbsoluta("/blog")}?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const SOFTWARE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "INYECTAIA",
  url: urlAbsoluta("/"),
  description: DESCRIPCION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  inLanguage: "es",
  offers: [
    {
      "@type": "Offer",
      name: "Gratis",
      price: "0",
      priceCurrency: "USD",
      description: "1 agente WhatsApp, 100 conversaciones/mes.",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      description: "Agentes ilimitados, voz clonada, multi-modelo IA.",
    },
  ],
};

export default async function PaginaLanding() {
  const posts = await listarArticulosPublicados({ limite: 3 }).catch(() => []);

  return (
    <div className="landing-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_SCHEMA) }}
      />
      <div className="landing-ambient" aria-hidden="true">
        <div className="orb a" />
        <div className="orb b" />
        <div className="orb c" />
      </div>
      <Navegacion />
      <Hero />
      <LogosClientes />
      <Metricas />
      <Funciones />
      <ComoFunciona />
      <Demo />
      <CasosDeUso />
      <VideoSection />
      <Precios />
      <TestimoniosSociales />
      <BlogSection posts={posts} />
      <PreguntasFrecuentes />
      <CtaFinal />
      <PieDePagina />
      <BotonLlamadaVapi />
      <BotoneFlotanteWhatsApp />
    </div>
  );
}
