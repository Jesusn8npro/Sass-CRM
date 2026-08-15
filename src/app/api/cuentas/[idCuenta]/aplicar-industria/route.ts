import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  crearConocimiento,
  crearProductosBulk,
} from "@/lib/baseDatos";
import {
  obtenerPlantillaIndustria,
  PLANTILLAS_INDUSTRIA,
} from "@/lib/plantillas-industria";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { PLAYBOOK_BASE } from "@/lib/playbook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Cuerpo {
  idIndustria?: unknown;
}

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/aplicar-industria
 *
 * Body: { idIndustria: string }
 *
 * Aplica una plantilla de industria (de PLANTILLAS_INDUSTRIA) a la
 * cuenta del usuario:
 *   1) Actualiza identidad del agente, mensajes y prompt sistema.
 *   2) Inserta productos de ejemplo (bulk).
 *   3) Inserta entradas de conocimiento (FAQ).
 *
 * Idempotente desde la perspectiva de la cuenta (sobreescribe campos),
 * pero NO desde la de productos / conocimiento (los suma).
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const cuerpo = await parsearJSON<Cuerpo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  const idIndustria =
    typeof cuerpo.idIndustria === "string" ? cuerpo.idIndustria : "";
  if (!idIndustria) {
    return NextResponse.json(
      { error: "Falta idIndustria" },
      { status: 400 },
    );
  }

  const plantilla = obtenerPlantillaIndustria(idIndustria);
  if (!plantilla) {
    return NextResponse.json(
      {
        error: `Industria "${idIndustria}" no existe`,
        disponibles: PLANTILLAS_INDUSTRIA.map((p) => p.id),
      },
      { status: 404 },
    );
  }

  // El playbook base sirve igual para un curso, una clínica o una
  // inmobiliaria: ninguna de las ocho respuestas afirma un hecho del
  // negocio. Lo sembramos en el onboarding para que el agente arranque
  // sabiendo qué hacer con "está caro" y con "¿me hacés descuento?",
  // en vez de improvisar. Si el dueño ya cargó el suyo, no lo pisamos.
  const yaTienePlaybook =
    Array.isArray(acceso.cuenta.playbook_objeciones) &&
    acceso.cuenta.playbook_objeciones.length > 0;

  // 1) Aplicar identidad y prompt a la cuenta.
  await actualizarCuenta(idCuenta, {
    ...(yaTienePlaybook
      ? {}
      : { playbook_objeciones: PLAYBOOK_BASE, playbook_activo: true }),
    agente_nombre: plantilla.agente_nombre_default,
    agente_rol: plantilla.agente_rol_default,
    agente_personalidad: plantilla.agente_personalidad_default,
    agente_tono: plantilla.agente_tono_default,
    agente_idioma: plantilla.agente_idioma_default,
    prompt_sistema: plantilla.prompt_sistema,
    mensaje_bienvenida: plantilla.mensaje_bienvenida,
    mensaje_no_entiende: plantilla.mensaje_no_entiende,
    palabras_handoff: plantilla.palabras_handoff,
    contexto_negocio: plantilla.contexto_negocio_template,
  });

  // 2) Insertar productos de ejemplo.
  const resBulk = await crearProductosBulk(
    idCuenta,
    plantilla.productos_ejemplo.map((p) => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      categoria: p.categoria,
    })),
  );

  // 3) Insertar conocimiento. crearConocimiento lleva orden interno; lo
  //    llamamos secuencial para preservar el orden del array.
  let conocimientoCreado = 0;
  for (const entrada of plantilla.conocimiento_inicial) {
    try {
      await crearConocimiento(idCuenta, entrada.titulo, entrada.contenido, {
        categoria: entrada.categoria,
      });
      conocimientoCreado += 1;
    } catch {
      // best-effort — si una entrada falla, seguimos con las otras.
    }
  }

  return NextResponse.json({
    ok: true,
    industria: plantilla.id,
    productos_creados: resBulk.creados.length,
    conocimiento_creado: conocimientoCreado,
  });
}
