import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarRunApify,
  agregarCreditos,
  listarLeadsDeRun,
  obtenerCuenta,
  obtenerRunApify,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { obtenerDefinicionActor } from "@/lib/apify/actors";
import { obtenerEstadoRun } from "@/lib/apify/cliente";
import { importarResultadosRun } from "@/lib/apify/importador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string; idRun: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/apify/runs/[idRun]/sincronizar
 *
 * Sirve para "rescatar" runs que en Apify completaron pero el webhook
 * no nos llegó (típico cuando se prueba en localhost o PUBLIC_URL
 * inalcanzable). Consulta el estado en Apify, importa items si terminó,
 * y actualiza la fila local.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idRun } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  const run = await obtenerRunApify(idRun);
  if (!run || run.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "run_no_encontrado" }, { status: 404 });
  }
  if (!run.apify_run_id) {
    return NextResponse.json(
      { error: "run_sin_apify_id", mensaje: "Este run nunca llegó a Apify" },
      { status: 400 },
    );
  }

  // Si el run ya está "completado" pero la bandeja está vacía (caso:
  // se completó con código viejo o la inserción falló), permitimos
  // re-importar desde Apify. Si ya tiene leads en bandeja, no hacemos
  // nada para evitar duplicados.
  if (run.estado === "completado") {
    const yaTiene = await listarLeadsDeRun(idRun);
    if (yaTiene.length > 0) {
      return NextResponse.json({
        ok: true,
        ya_completado: true,
        leads_en_bandeja: yaTiene.length,
      });
    }
    // Re-importar: la bandeja está vacía → vamos a leer Apify de nuevo
  }

  const estado = await obtenerEstadoRun(run.apify_run_id);
  if (!estado) {
    return NextResponse.json(
      { error: "no_se_pudo_consultar", mensaje: "Apify no respondió" },
      { status: 502 },
    );
  }

  const ahora = new Date().toISOString();
  const def = obtenerDefinicionActor(run.actor_id);
  // Es re-importacion si el run ya estaba completado de antes (no tocamos
  // creditos ni status — solo persistimos los leads en bandeja).
  const esReimportacion = run.estado === "completado";

  if (estado.status === "SUCCEEDED" && estado.defaultDatasetId) {
    try {
      const resumen = await importarResultadosRun({
        cuentaId: run.cuenta_id,
        apifyDatasetId: estado.defaultDatasetId,
        runApifyId: run.id,
        actorIdInterno: run.actor_id,
      });

      if (!esReimportacion) {
        const itemsReales = resumen.leads_guardados;
        const itemsCobrados = run.costo_creditos / (def?.creditosPorItem ?? 1);
        if (itemsReales < itemsCobrados && def) {
          const reintegrar = Math.floor(
            (itemsCobrados - itemsReales) * def.creditosPorItem,
          );
          if (reintegrar > 0) {
            await agregarCreditos(run.cuenta_id, reintegrar);
          }
        }

        await actualizarRunApify(run.id, {
          estado: "completado",
          apify_dataset_id: estado.defaultDatasetId,
          items_count: itemsReales,
          costo_usd: itemsReales * (def?.costoUsdPorItem ?? 0),
          completado_en: ahora,
        });
      }
      return NextResponse.json({ ok: true, resumen, reimportado: esReimportacion });
    } catch (err) {
      if (!esReimportacion) {
        await actualizarRunApify(run.id, {
          estado: "fallido",
          error: err instanceof Error ? err.message : String(err),
          completado_en: ahora,
        });
      }
      return NextResponse.json(
        {
          error: "error_importando",
          mensaje: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      );
    }
  }

  if (
    estado.status === "FAILED" ||
    estado.status === "ABORTED" ||
    estado.status === "TIMED-OUT"
  ) {
    await agregarCreditos(run.cuenta_id, run.costo_creditos);
    await actualizarRunApify(run.id, {
      estado: estado.status === "ABORTED" ? "abortado" : "fallido",
      error: `Apify status: ${estado.status}`,
      completado_en: ahora,
    });
    return NextResponse.json({ ok: true, estado_apify: estado.status });
  }

  // Sigue corriendo en Apify
  return NextResponse.json({
    ok: true,
    todavia_corriendo: true,
    estado_apify: estado.status,
  });
}
