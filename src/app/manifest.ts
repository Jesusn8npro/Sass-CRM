import type { MetadataRoute } from "next";

/**
 * PWA manifest. Cuando agregues íconos reales en /public (icon-192.png,
 * icon-512.png), descomentá el array `icons` para habilitar "Add to home
 * screen" en mobile.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sass-CRM",
    short_name: "Sass-CRM",
    description:
      "Agente IA para WhatsApp: responde leads, agenda citas y cierra ventas 24/7.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#10b981",
  };
}
