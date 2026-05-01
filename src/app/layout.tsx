import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agente WhatsApp",
  description: "Panel local para conversar y supervisar tu agente de WhatsApp.",
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
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptInicializaTema }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
