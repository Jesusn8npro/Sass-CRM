/**
 * URL base del sitio para construir URLs absolutas (sitemap, OG tags,
 * canonical, JSON-LD). Lee de env con fallback razonable.
 */
export function siteUrl(): string {
  const candidato =
    process.env.APP_URL ?? process.env.PUBLIC_URL ?? "http://localhost:3000";
  return candidato.replace(/\/$/, "");
}

/**
 * Construye una URL absoluta a partir de un path relativo.
 */
export function urlAbsoluta(path: string): string {
  const base = siteUrl();
  const limpio = path.startsWith("/") ? path : `/${path}`;
  return `${base}${limpio}`;
}
