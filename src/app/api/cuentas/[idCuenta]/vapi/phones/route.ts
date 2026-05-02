import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { listarPhoneNumbers } from "@/lib/vapi";
import { requerirSesion } from "@/lib/auth/sesion";
import { resolverCredencialesVapi } from "@/lib/vapi-credenciales";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const cred = resolverCredencialesVapi(cuenta);
  if (!cred.apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta API key de Vapi (ni en la cuenta ni en VAPI_API_KEY del entorno).",
      },
      { status: 400 },
    );
  }
  try {
    const phones = await listarPhoneNumbers(cred.apiKey);
    return NextResponse.json({ phones });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
