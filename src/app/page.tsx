import type { Metadata } from "next";
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
import { LogosClientes } from "./_componentes-landing/LogosClientes";
import { TestimoniosSociales } from "./_componentes-landing/TestimoniosSociales";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

const TITULO = "Agente de WhatsApp con IA para PYMEs — Sass-CRM";
const DESCRIPCION =
  "Automatiza tu WhatsApp Business con IA: responde leads, agenda citas y cierra ventas 24/7 sin programar. Gratis para empezar.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  keywords: [
    "agente whatsapp ia",
    "automatizar whatsapp business",
    "chatbot whatsapp pymes",
    "crm whatsapp",
    "ventas whatsapp automatico",
    "bot whatsapp colombia",
    "bot whatsapp argentina",
    "bot whatsapp mexico",
    "automatizacion whatsapp latam",
    "whatsapp business ia pymes",
    "agendar citas whatsapp ia",
    "responder whatsapp automatico",
  ],
  alternates: { canonical: urlAbsoluta("/") },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: urlAbsoluta("/"),
    type: "website",
    locale: "es_419",
    siteName: "Sass-CRM",
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
      name: "¿Esto banea mi WhatsApp?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. WhatsApp Web (no API oficial), límites diarios, jitter humano, horarios respetados. Diseñado para no quemar números.",
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
      name: "¿Mis datos están seguros?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí. Postgres con Row Level Security y encriptación. Cada usuario ve solo sus cuentas. Las claves de IA son privadas por cuenta.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cuánto tarda el setup?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "2 minutos crear cuenta + escanear QR. 30 minutos configurar catálogo y prompt. Vendiendo el mismo día.",
      },
    },
    {
      "@type": "Question",
      name: "¿Puedo migrar de n8n / Wati / Botmaker?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí. Te ayudamos a importar contactos y conversaciones. Curva de aprendizaje: 1 día comparado con n8n.",
      },
    },
  ],
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Sass-CRM",
  url: urlAbsoluta("/"),
  description: DESCRIPCION,
  foundingLocation: { "@type": "Place", name: "Colombia" },
  sameAs: [],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Sass-CRM",
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
  name: "Sass-CRM",
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
      description: "1 cuenta WhatsApp, 100 conversaciones/mes.",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "29",
      priceCurrency: "USD",
      description: "WhatsApp ilimitados, voz clonada, multi-modelo.",
    },
  ],
};

export default function PaginaLanding() {
  return (
    <main className="min-h-screen bg-black font-sans text-white antialiased [color-scheme:dark]">
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
      <Navegacion />
      <Hero />
      <LogosClientes />
      <Metricas />
      <ComoFunciona />
      <Funciones />
      <TestimoniosSociales />
      <CasosDeUso />
      <Precios />
      <PreguntasFrecuentes />
      <CtaFinal />
      <PieDePagina />
    </main>
  );
}
