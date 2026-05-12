/**
 * robots.txt dinámico para crawlers.
 *
 * Bloqueamos rutas privadas (panel, admin, API) y permitimos todo lo
 * público. Apuntamos al sitemap dinámico.
 */
import type { MetadataRoute } from "next";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/blog/"],
        disallow: [
          "/app/",
          "/admin/",
          "/api/",
          "/login",
          "/signup",
        ],
      },
    ],
    sitemap: urlAbsoluta("/sitemap.xml"),
    host: urlAbsoluta(""),
  };
}
