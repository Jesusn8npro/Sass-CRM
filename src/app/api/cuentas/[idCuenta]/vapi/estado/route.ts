import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { credencialesParaCliente } from "@/lib/vapi-credenciales";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * Devuelve el estado de configuración Vapi para esta cuenta,
 * considerando tanto los campos de la cuenta como el fallback al .env
 * del sistema (VAPI_API_KEY, VAPI_PUBLIC_KEY, VAPI_PHONE_NUMBER_ID).
 *
 * Respuesta:
 *  - publicKey: la public key efectiva (safe-to-expose), o null
 *  - phoneNumberId: el ID efectivo del phone, o null
 *  - configurado: true si hay api_key + phone_id (considerando env)
 *  - origenes: de dónde viene cada credencial ("cuenta" | "env" | "ninguno")
 *
 * NUNCA devuelve la api_key (es secret).
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  return NextResponse.json(credencialesParaCliente(cuenta));
}
