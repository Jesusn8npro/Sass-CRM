import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { ProveedoresUI } from "@/components/ProveedoresUI";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--fuente-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--fuente-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--fuente-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "INYECTAIA — Agentes de IA para WhatsApp y Ventas",
    template: "%s · INYECTAIA",
  },
  description:
    "Inyectamos IA en tu negocio: agentes WhatsApp que venden 24/7, llamadas con voz clonada, prospección automática y pipeline inteligente. Sin código.",
  metadataBase: new URL(
    process.env.APP_URL ?? process.env.PUBLIC_URL ?? "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        {/* Render-blocking: corre antes del primer paint para evitar flash de tema */}
        <script src="/tema-init.js" />
        {/* Preconnect a Supabase Storage — las imágenes del blog vienen de ahí */}
        <link rel="preconnect" href="https://wvkmxacnsnuuwcggbopv.supabase.co" />
        <link rel="dns-prefetch" href="https://wvkmxacnsnuuwcggbopv.supabase.co" />
        {/* Speculation Rules — prerender páginas del blog al hover (Chromium 121+) */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: '{"prerender":[{"where":{"href_matches":"/blog/*"},"eagerness":"moderate"}]}',
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <ProveedoresUI>{children}</ProveedoresUI>
      </body>
    </html>
  );
}
