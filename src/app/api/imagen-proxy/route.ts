import { type NextRequest, NextResponse } from "next/server";

// Cachea imágenes del blog por 7 días en el CDN.
// Evita que cada visita genere egress en Supabase Storage.
export const dynamic = "force-static";

const DOMINIOS_PERMITIDOS = [
  ".supabase.co",
  ".supabase.in",
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("url requerida", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("url inválida", { status: 400 });
  }

  const permitida = DOMINIOS_PERMITIDOS.some((d) => parsed.hostname.endsWith(d));
  if (!permitida) {
    return new NextResponse("dominio no permitido", { status: 403 });
  }

  const upstream = await fetch(url, {
    next: { revalidate: 604_800 }, // 7 días
  });

  if (!upstream.ok) {
    return new NextResponse("error al obtener imagen", { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/webp";
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
