import type { NextConfig } from "next";

/**
 * Headers de seguridad globales. PayPal y Resend cargan iframes/scripts
 * propios — la CSP los permite explícitamente. El bot Baileys, ffmpeg
 * y pino corren en server-only y van a `serverExternalPackages` para
 * que el bundler no los procese.
 */
const HEADERS_SEGURIDAD = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.elevenlabs.io https://api.vapi.ai https://api.paypal.com https://api.sandbox.paypal.com https://*.paypal.com",
      "frame-src https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "better-sqlite3",
    "pino",
    "ffmpeg-static",
  ],
  // Imágenes del blog (bucket público Supabase Storage) optimizadas por
  // Next: AVIF/WebP auto, sizes responsive, lazy loading nativo, cache
  // inmutable. Mejora LCP del blog ~30-50% vs <img> plano.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 año — paths incluyen hash
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: HEADERS_SEGURIDAD,
      },
      // Sitemap y robots: cache agresivo + stale-while-revalidate.
      // Next ya regenera el sitemap cada 600s (revalidate); el header
      // ayuda al edge CDN.
      {
        source: "/sitemap.xml",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=600, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/robots.txt",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400",
          },
        ],
      },
      // /blog/* — HTML cacheable con revalidación rápida.
      // Las páginas ya son SSG con revalidate por Next, pero el header
      // ayuda a CDN/proxies en frente del servidor.
      {
        source: "/blog/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
