import { NextResponse, type NextRequest } from "next/server";
import {
  guardarPasoOnboarding,
  marcarOnboardingCompleto,
  type PasoOnboarding,
} from "@/lib/baseDatos";
import { parsearJSON, requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PASOS_VALIDOS: PasoOnboarding[] = [
  "conectar",
  "plantilla",
  "productos",
  "probar",
];

interface Cuerpo {
  paso?: unknown;
  completo?: unknown;
}

/**
 * POST /api/onboarding/paso
 *
 * Body: { paso?: "conectar"|"plantilla"|"productos"|"probar", completo?: boolean }
 *
 * Persiste el progreso del usuario en `usuarios.onboarding_paso`.
 * Si `completo === true`, marca `usuarios.completo_onboarding = true`
 * y limpia el paso.
 */
export async function POST(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const cuerpo = await parsearJSON<Cuerpo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  if (cuerpo.completo === true) {
    await marcarOnboardingCompleto(auth.id);
    return NextResponse.json({ ok: true, completo: true });
  }

  const paso = cuerpo.paso;
  if (typeof paso !== "string" || !PASOS_VALIDOS.includes(paso as PasoOnboarding)) {
    return NextResponse.json(
      { error: "Paso inválido" },
      { status: 400 },
    );
  }

  await guardarPasoOnboarding(auth.id, paso as PasoOnboarding);
  return NextResponse.json({ ok: true, paso });
}
