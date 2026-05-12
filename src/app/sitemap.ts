/**
 * Sitemap dinámico para Google Search.
 *
 * Incluye:
 *   - Páginas estáticas principales (home, blog, signup, login).
 *   - Todas las páginas de blog publicadas (con `lastModified`).
 *   - Páginas de categoría del blog.
 *
 * Servido en /sitemap.xml — Next genera el XML correcto desde este array.
 */
import type { MetadataRoute } from "next";
import { listarSlugsPublicados, listarCategorias } from "@/lib/baseDatos";
import { urlAbsoluta } from "@/lib/blog/siteUrl";

export const revalidate = 600; // 10 min

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    {
      url: urlAbsoluta("/"),
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: urlAbsoluta("/blog"),
      lastModified: ahora,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: urlAbsoluta("/signup"),
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: urlAbsoluta("/login"),
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Blog: artículos publicados
  let articulos: MetadataRoute.Sitemap = [];
  try {
    const slugs = await listarSlugsPublicados();
    articulos = slugs.map((s) => ({
      url: urlAbsoluta(`/blog/${s.slug}`),
      lastModified: new Date(s.actualizado_en),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.warn("[sitemap] no se pudieron listar artículos:", err);
  }

  // Blog: categorías
  let categorias: MetadataRoute.Sitemap = [];
  try {
    const cats = await listarCategorias();
    categorias = cats.map((c) => ({
      url: urlAbsoluta(`/blog/categoria/${c.slug}`),
      lastModified: ahora,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.warn("[sitemap] no se pudieron listar categorías:", err);
  }

  return [...estaticas, ...articulos, ...categorias];
}
