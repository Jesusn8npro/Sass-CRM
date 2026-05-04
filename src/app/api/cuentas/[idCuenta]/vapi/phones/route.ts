import { NextResponse, type NextRequest } from "next/server";
import { listarPhoneNumbers } from "@/lib/vapi";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { resolverCredencialesVapi } from "@/lib/vapi-credenciales";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;
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
