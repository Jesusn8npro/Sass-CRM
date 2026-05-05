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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: HEADERS_SEGURIDAD,
      },
    ];
  },
};

export default nextConfig;
