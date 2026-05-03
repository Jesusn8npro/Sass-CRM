/**
 * Catálogo de actors de Apify expuestos al usuario final. Empezamos
 * con UNO solo (Google Maps + email) hasta validar conversión.
 *
 * Cada actor tiene un id Apify, un mapper de UI-form → Apify input,
 * y un mapper de item Apify → fila para insertar en contactos_email
 * y contactos_telefono.
 */

export interface DefinicionActor {
  /** ID interno (lo usamos en URLs y DB) */
  id: string;
  /** ID en Apify Store */
  apifyId: string;
  etiqueta: string;
  descripcion: string;
  emoji: string;
  /** Costo aproximado en USD por result (lo que vos pagás a Apify). */
  costoUsdPorItem: number;
  /** Cuántos créditos tuyos cuesta cada item. 1 cred = ~$0.10 cliente. */
  creditosPorItem: number;
}

export const ACTORS_DISPONIBLES: DefinicionActor[] = [
  {
    id: "google_maps_emails",
    apifyId: "lukaskrivka/google-maps-with-contact-details",
    etiqueta: "Google Maps + emails",
    descripcion:
      "Busca en Google Maps por término + ciudad y extrae nombre, " +
      "dirección, teléfono, sitio web y email (rascando el sitio).",
    emoji: "🗺️",
    costoUsdPorItem: 0.01,
    creditosPorItem: 1,
  },
];

export function obtenerDefinicionActor(id: string): DefinicionActor | null {
  return ACTORS_DISPONIBLES.find((a) => a.id === id) ?? null;
}

// ============================================================
// Builders de input de cada actor
// ============================================================

export interface InputGoogleMapsEmails {
  /** "restaurantes", "veterinarias", "abogados de familia"... */
  busqueda: string;
  /** "Bogotá, Colombia", "CABA, Argentina"... */
  ubicacion: string;
  /** Cuántos lugares máximo. */
  maxResultados: number;
  /** "es", "en"... */
  idioma?: string;
}

export function construirInputGoogleMaps(
  data: InputGoogleMapsEmails,
): Record<string, unknown> {
  return {
    searchStringsArray: [data.busqueda],
    locationQuery: data.ubicacion,
    maxCrawledPlacesPerSearch: data.maxResultados,
    language: data.idioma ?? "es",
    // Hacemos que también scrapee el sitio en busca de email
    scrapeContacts: true,
    skipClosedPlaces: true,
    includeWebResults: false,
  };
}

// ============================================================
// Mappers de item Apify → contacto interno
// ============================================================

export interface ItemContactoExtraido {
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  sitio_web: string | null;
  categoria: string | null;
  raw: Record<string, unknown>;
}

interface ItemGoogleMaps {
  title?: string;
  phone?: string | null;
  emails?: string[] | null;
  address?: string | null;
  website?: string | null;
  categoryName?: string | null;
}

export function mapearItemGoogleMaps(
  item: unknown,
): ItemContactoExtraido | null {
  const it = item as ItemGoogleMaps;
  if (!it || typeof it !== "object") return null;
  if (!it.title) return null;
  return {
    nombre: it.title,
    telefono: typeof it.phone === "string" ? it.phone : null,
    email:
      Array.isArray(it.emails) && it.emails.length > 0 ? it.emails[0]! : null,
    direccion: typeof it.address === "string" ? it.address : null,
    sitio_web: typeof it.website === "string" ? it.website : null,
    categoria: typeof it.categoryName === "string" ? it.categoryName : null,
    raw: it as Record<string, unknown>,
  };
}

/**
 * Resuelve el mapper correcto según el id del actor.
 */
export function mapearItem(
  actorId: string,
  item: unknown,
): ItemContactoExtraido | null {
  if (actorId === "google_maps_emails") {
    return mapearItemGoogleMaps(item);
  }
  return null;
}
