/**
 * CRUD de la conexión a un Supabase externo de la cuenta.
 *
 * GET    → devuelve el estado de la conexión (sin la key).
 * POST   → valida credenciales contra el Supabase externo y, si funcionan,
 *          las guarda. Devuelve estado + tablas descubiertas.
 * DELETE → desconecta (borra credenciales).
 *
 * Auth: sesión Supabase + ownership de la cuenta.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  ColumnasExternoNoDisponiblesError,
  borrarConfigExterna,
  guardarConfigAgenteExterno,
  guardarConfigExterna,
  obtenerConfigExterna,
  probarConexionExterna,
} from "@/lib/db/supabaseExterno";
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

  const config = await obtenerConfigExterna(idCuenta);
  return NextResponse.json(config);
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  // Máximo 10 intentos de validación por hora (evita abusar de fetch externo).
  const rl = verificarRateLimit(`${auth.id}:supabase-externo-validar`, 10, 3600);
  if (rl) return rl;

  const payload = await parsearJSON<{ url?: unknown; service_key?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const serviceKey =
    typeof payload.service_key === "string" ? payload.service_key.trim() : "";
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Faltan la URL y la service_role key." },
      { status: 400 },
    );
  }

  const prueba = await probarConexionExterna(url, serviceKey);
  if (!prueba.ok) {
    return NextResponse.json({ error: prueba.error }, { status: 400 });
  }

  try {
    await guardarConfigExterna({
      cuentaId: idCuenta,
      url: prueba.urlNormalizada,
      serviceKey,
      tablas: prueba.tablas,
    });
  } catch (err) {
    if (err instanceof ColumnasExternoNoDisponiblesError) {
      return NextResponse.json(
        {
          error:
            "La conexión externa aún no está habilitada. Aplicá la migración 38_supabase_externo.sql en Supabase.",
        },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(
    {
      conectado: true,
      url: prueba.urlNormalizada,
      validado_en: new Date().toISOString(),
      tablas: prueba.tablas,
    },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<{
    habilitado?: unknown;
    tablas_permitidas?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  const habilitado = payload.habilitado === true;
  const tablasPermitidas = Array.isArray(payload.tablas_permitidas)
    ? payload.tablas_permitidas.filter((t): t is string => typeof t === "string")
    : [];

  try {
    await guardarConfigAgenteExterno({ cuentaId: idCuenta, habilitado, tablasPermitidas });
  } catch (err) {
    if (err instanceof ColumnasExternoNoDisponiblesError) {
      return NextResponse.json({ error: "Migración 38/39 no aplicada." }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json(await obtenerConfigExterna(idCuenta));
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  try {
    await borrarConfigExterna(idCuenta);
  } catch (err) {
    if (err instanceof ColumnasExternoNoDisponiblesError) {
      return NextResponse.json({ error: "Migración 38 no aplicada." }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
