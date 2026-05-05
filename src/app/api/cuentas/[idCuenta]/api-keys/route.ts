/**
 * CRUD admin de API keys públicas.
 *
 * GET  → lista las keys de la cuenta (sin plaintext)
 * POST → crea una nueva, devuelve plaintext UNA SOLA VEZ
 *
 * Auth: sesión Supabase + ownership de cuenta (no API key — esto es admin).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  TablaApiKeysNoDisponibleError,
  crearApiKey,
  listarApiKeysDeCuenta,
} from "@/lib/db/apiKeys";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const apiKeys = await listarApiKeysDeCuenta(idCuenta);
  return NextResponse.json({ api_keys: apiKeys });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  // Rate limit: máximo 5 keys nuevas por hora por usuario.
  const rl = verificarRateLimit(`${auth.id}:api-keys-crear`, 5, 3600);
  if (rl) return rl;

  const payload = await parsearJSON<{
    nombre?: unknown;
    permisos?: unknown;
    expira_en?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  const nombre =
    typeof payload.nombre === "string" ? payload.nombre.trim() : "";
  if (!nombre) {
    return NextResponse.json(
      { error: "El nombre es obligatorio" },
      { status: 400 },
    );
  }

  const permisos = Array.isArray(payload.permisos)
    ? (payload.permisos.filter((p) => typeof p === "string") as string[])
    : undefined;

  const expiraEn =
    typeof payload.expira_en === "string" && payload.expira_en
      ? payload.expira_en
      : null;

  try {
    const { apiKey, clavePlaintext } = await crearApiKey({
      cuentaId: idCuenta,
      usuarioId: auth.id,
      nombre,
      permisos,
      expiraEn,
    });
    return NextResponse.json(
      { api_key: apiKey, clave_plaintext: clavePlaintext },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof TablaApiKeysNoDisponibleError) {
      return NextResponse.json(
        {
          error:
            "Las API keys aún no están habilitadas. Aplicá la migración 10_api_keys.sql en Supabase.",
        },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
