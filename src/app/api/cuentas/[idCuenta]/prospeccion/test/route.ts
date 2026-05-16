import { NextResponse } from "next/server";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { db } from "@/lib/db/cliente";
import { obtenerCuenta } from "@/lib/baseDatos";
import { dispararLlamadaOutreach } from "@/lib/outreach/disparadorVapi";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/cuentas/[idCuenta]/prospeccion/test
 *
 * Inserta un lead de prueba y dispara una llamada Vapi al número indicado.
 * Body (JSON): { telefonoPrueba?: string }
 * Si no se pasa telefonoPrueba, usa OUTREACH_TEST_PHONE del ENV
 * (en ese caso requiere OUTREACH_TEST_MODE=true).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ idCuenta: string }> },
) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const body = await req.json().catch(() => ({})) as { telefonoPrueba?: unknown };
  const telefonoPruebaUI =
    typeof body.telefonoPrueba === "string" && body.telefonoPrueba.trim()
      ? body.telefonoPrueba.trim()
      : null;

  // Si no se provee teléfono en la UI, requerir TEST_MODE para evitar llamadas accidentales
  const modoTest = process.env.OUTREACH_TEST_MODE === "true";
  if (!telefonoPruebaUI && !modoTest) {
    return NextResponse.json(
      { error: "Ingresá un número de prueba en el campo o activá OUTREACH_TEST_MODE=true en las variables de entorno." },
      { status: 400 },
    );
  }

  const telefonoPrueba = telefonoPruebaUI ?? process.env.OUTREACH_TEST_PHONE ?? "+573123790071";

  // Crear run_apify de prueba (requerido por FK de leads_extraidos)
  const { data: runPrueba, error: errRun } = await db()
    .from("runs_apify")
    .insert({
      cuenta_id: idCuenta,
      actor_id: "test/prospeccion-test",
      input: { fuente: "test_endpoint" },
      estado: "completado",
    })
    .select("id")
    .single();

  if (errRun) {
    return NextResponse.json(
      { error: `No se pudo crear run de prueba: ${errRun.message}` },
      { status: 500 },
    );
  }

  // Insertar lead de prueba
  const { data: leadPrueba, error: errInsert } = await db()
    .from("leads_extraidos")
    .insert({
      cuenta_id: idCuenta,
      run_apify_id: runPrueba.id,
      nombre: "Negocio de Prueba S.A.S",
      telefono: telefonoPrueba,
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

  // Obtener cuenta completa para resolver credenciales Vapi
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  }

  // Llamar directamente a dispararLlamadaOutreach para ver el error exacto
  const resultado = await dispararLlamadaOutreach(
    /* lead = */ {
      id: leadPrueba!.id,
      cuenta_id: idCuenta,
      nombre: "Negocio de Prueba S.A.S",
      telefono: telefonoPrueba,
      email: process.env.OUTREACH_TEST_EMAIL ?? null,
      categoria: "Servicios de prueba",
      direccion: "Calle Ficticia 123, Bogotá",
      sitio_web: null,
      estado_prospeccion: "nuevo",
      metodo_contacto: null,
      intentos_outreach: 0,
      fuente_url: null,
      run_apify_id: runPrueba.id,
      raw: {},
      creado_en: new Date().toISOString(),
      prospeccion_actualizado_en: new Date().toISOString(),
      importado: false,
      conversacion_id: null,
    },
    /* cuenta = */ cuenta,
    /* overrides = */ { telefonoPrueba },
  );

  if (!resultado.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: resultado.error ?? "Error desconocido al disparar llamada Vapi.",
        lead: leadPrueba,
        consejo: "Revisá que VAPI_PRIVATE_KEY, VAPI_PHONE_NUMBER_ID y OUTREACH_ASSISTANT_ID estén en EasyPanel.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mensaje: `Llamada disparada. Revisá el teléfono ${telefonoPrueba}.`,
    vapi_call_id: resultado.vapiCallId,
    lead: leadPrueba,
    modo_prueba: true,
  });
}
