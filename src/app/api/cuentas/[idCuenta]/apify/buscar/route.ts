import { NextResponse, type NextRequest } from "next/server";
import {
  agregarCreditos,
  crearRunApify,
  descontarCreditos,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import {
  construirInputGoogleMaps,
  obtenerDefinicionActor,
  type InputGoogleMapsEmails,
} from "@/lib/apify/actors";
import {
  asociarApifyRunId,
  actualizarRunApify,
} from "@/lib/db/runsApify";
import { iniciarRunAsync } from "@/lib/apify/cliente";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface BodyRequest {
  actor_id: string;
  input: InputGoogleMapsEmails;
}

/**
 * POST /api/cuentas/[idCuenta]/apify/buscar
 * Body: { actor_id, input }
 *
 * Descuenta créditos según `maxResultados * creditos_por_item`,
 * lanza el run en Apify (async, devuelve apify_run_id), y registra
 * todo en runs_apify. El usuario ve el progreso por polling al GET
 * /apify/runs.
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  let body: BodyRequest;
  try {
    body = (await req.json()) as BodyRequest;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const def = obtenerDefinicionActor(body.actor_id);
  if (!def) {
    return NextResponse.json({ error: "actor_invalido" }, { status: 400 });
  }

  const max = Number(body.input.maxResultados);
  if (!Number.isFinite(max) || max < 1 || max > 200) {
    return NextResponse.json(
      { error: "max_resultados_invalido", mensaje: "Entre 1 y 200" },
      { status: 400 },
    );
  }
  if (!body.input.busqueda?.trim() || !body.input.ubicacion?.trim()) {
    return NextResponse.json(
      { error: "faltan_busqueda_o_ubicacion" },
      { status: 400 },
    );
  }

  // Cobramos al lanzar (peor caso). Si vuelven menos resultados,
  // reintegramos la diferencia al recibir el webhook.
  const costoCreditosMax = max * def.creditosPorItem;
  const ok = await descontarCreditos(
    idCuenta,
    "apify_lead",
    costoCreditosMax,
    {
      costoUsd: max * def.costoUsdPorItem,
      metadata: {
        actor: def.id,
        busqueda: body.input.busqueda,
        ubicacion: body.input.ubicacion,
      },
    },
  );
  if (!ok) {
    return NextResponse.json(
      {
        error: "creditos_insuficientes",
        mensaje: `Necesitás ${costoCreditosMax} créditos para esta búsqueda.`,
      },
      { status: 402 },
    );
  }

  // Crear fila pendiente
  const inputApify = construirInputGoogleMaps(body.input);
  const fila = await crearRunApify({
    cuenta_id: idCuenta,
    actor_id: def.id,
    input: inputApify,
    costo_creditos: costoCreditosMax,
  });

  // Lanzar en Apify
  try {
    const run = await iniciarRunAsync({
      apifyActorId: def.apifyId,
      inputActor: inputApify,
      jobIdInterno: fila.id,
    });
    await asociarApifyRunId(fila.id, run.apifyRunId);
    return NextResponse.json({
      ok: true,
      job_id: fila.id,
      apify_run_id: run.apifyRunId,
      costo_creditos: costoCreditosMax,
    });
  } catch (err) {
    // Reintegrar créditos si Apify rechazó el lanzamiento
    await agregarCreditos(idCuenta, costoCreditosMax);
    await actualizarRunApify(fila.id, {
      estado: "fallido",
      error: err instanceof Error ? err.message : String(err),
      completado_en: new Date().toISOString(),
    });
    console.error("[apify:buscar]", err);
    return NextResponse.json(
      {
        error: "error_lanzando_apify",
        mensaje: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 502 },
    );
  }
}
