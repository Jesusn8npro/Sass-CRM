/**
 * POST /api/v1/conversaciones/[idCuenta]/mensaje
 *
 * Endpoint público de la API v1. Encola un mensaje saliente en
 * `bandeja_salida` para que el bot lo despache.
 *
 * Body: `{ telefono: string, contenido: string, tipo?: 'texto'|'imagen'|... }`
 *
 * Auth: header `Authorization: Bearer sk_live_...` scopeada a `idCuenta`.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  encolarBandejaSalida,
  insertarMensaje,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import type { TipoMensaje } from "@/lib/db/tipos";
import { parsearJSON, verificarApiKey } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const TIPOS_VALIDOS: readonly TipoMensaje[] = [
  "texto",
  "imagen",
  "audio",
  "video",
  "documento",
  "sistema",
];

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const auth = await verificarApiKey(req);
  if (auth instanceof NextResponse) return auth;

  if (auth.cuenta.id !== idCuenta) {
    return NextResponse.json(
      { error: "Esta API key no tiene acceso a esa cuenta" },
      { status: 403 },
    );
  }

  // Permiso requerido: write
  if (!auth.apiKey.permisos.includes("write")) {
    return NextResponse.json(
      { error: "Esta API key no tiene permiso de escritura" },
      { status: 403 },
    );
  }

  const payload = await parsearJSON<{
    telefono?: unknown;
    contenido?: unknown;
    tipo?: unknown;
  }>(req);
  if (payload instanceof NextResponse) return payload;

  const telefonoRaw =
    typeof payload.telefono === "string" ? payload.telefono : "";
  const telefono = telefonoRaw.replace(/[^\d]/g, "");
  if (telefono.length < 8 || telefono.length > 15) {
    return NextResponse.json(
      {
        error:
          "Número inválido. Incluí código de país (ej: 5491123456789).",
      },
      { status: 400 },
    );
  }

  const contenido =
    typeof payload.contenido === "string" ? payload.contenido.trim() : "";
  if (!contenido) {
    return NextResponse.json(
      { error: "El contenido no puede estar vacío" },
      { status: 400 },
    );
  }

  const tipoRaw = typeof payload.tipo === "string" ? payload.tipo : "texto";
  const tipo: TipoMensaje = (TIPOS_VALIDOS as readonly string[]).includes(
    tipoRaw,
  )
    ? (tipoRaw as TipoMensaje)
    : "texto";

  const conv = await obtenerOCrearConversacion(idCuenta, telefono);
  await insertarMensaje(idCuenta, conv.id, "humano", contenido, { tipo });
  const idMensaje = await encolarBandejaSalida(
    idCuenta,
    conv.id,
    telefono,
    contenido,
    { tipo },
  );

  return NextResponse.json(
    {
      id_mensaje: idMensaje,
      conversacion_id: conv.id,
      estado: "encolado",
    },
    { status: 201 },
  );
}
