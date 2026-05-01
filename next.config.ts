import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "better-sqlite3",
    "pino",
    "ffmpeg-static",
  ],
};

export default nextConfig;
