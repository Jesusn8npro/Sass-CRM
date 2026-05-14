import { NextResponse } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { db } from "@/lib/db/cliente";
import { procesarOutreachCuenta } from "@/lib/outreach/orquestador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/cuentas/[idCuenta]/prospeccion/test
 *
 * Inserta un lead de prueba y dispara el orquestador para esa cuenta.
 * Con OUTREACH_TEST_MODE=true la llamada va a OUTREACH_TEST_PHONE.
 * Útil para verificar que el pipeline funciona sin leads reales.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const modoTest = process.env.OUTREACH_TEST_MODE === "true";
  if (!modoTest) {
    return NextResponse.json(
      { error: "Este endpoint solo funciona con OUTREACH_TEST_MODE=true para evitar llamadas reales accidentales." },
      { status: 400 },
    );
  }

  // Insertar lead de prueba
  const { data: leadPrueba, error: errInsert } = await db()
    .from("leads_extraidos")
    .insert({
      cuenta_id: idCuenta,
      run_apify_id: crypto.randomUUID(),
      nombre: "Negocio de Prueba S.A.S",
      telefono: process.env.OUTREACH_TEST_PHONE ?? "+573123790071",
      email: process.env.OUTREACH_TEST_EMAIL ?? null,
      direccion: "Calle Ficticia 123, Bogotá",
      sitio_web: null,
      categoria: "Servicios de prueba",
      fuente_url: null,
      raw: { fuente: "test_endpoint" },
      estado_prospeccion: "nuevo",
    })
    .select("id, nombre")
    .single();

  if (errInsert) {
    return NextResponse.json(
      { error: `No se pudo insertar lead de prueba: ${errInsert.message}` },
      { status: 500 },
    );
  }

  // Disparar orquestador para esta cuenta
  try {
    await procesarOutreachCuenta(idCuenta);
  } catch (err) {
    return NextResponse.json(
      {
        advertencia: "Lead insertado pero el orquestador falló.",
        lead: leadPrueba,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 207 },
    );
  }

  return NextResponse.json({
    ok: true,
    mensaje: `Lead de prueba insertado y orquestador ejecutado. Revisá los logs y tu teléfono ${process.env.OUTREACH_TEST_PHONE}.`,
    lead: leadPrueba,
    modo_prueba: true,
  });
}
