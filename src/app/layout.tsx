import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Sass-CRM — Agente WhatsApp con IA",
    template: "%s · Sass-CRM",
  },
  description:
    "Automatiza tu WhatsApp Business con IA: responde leads, agenda citas y cierra ventas 24/7 sin programar.",
  metadataBase: new URL(
    process.env.APP_URL ?? process.env.PUBLIC_URL ?? "http://localhost:3000",
  ),
};

const scriptInicializaTema = `
(function() {
  try {
    var t = localStorage.getItem('tema');
    if (!t) {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    }
    if (t === 'oscuro') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptInicializaTema }} />
        {/* Preconnect a Supabase Storage — las imágenes del blog vienen de ahí */}
        <link rel="preconnect" href="https://hecrpmywujicgwcqmxbp.supabase.co" />
        <link rel="dns-prefetch" href="https://hecrpmywujicgwcqmxbp.supabase.co" />
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
