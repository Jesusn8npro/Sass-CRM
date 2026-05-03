import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarRunApify,
  agregarCreditos,
  obtenerRunApifyPorApifyId,
} from "@/lib/baseDatos";
import { obtenerDefinicionActor } from "@/lib/apify/actors";
import { verificarFirmaWebhook } from "@/lib/apify/cliente";
import { importarResultadosRun } from "@/lib/apify/importador";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/apify/webhook
 *
 * Endpoint público (no requiere sesión) que Apify llama cuando un run
 * termina. Verificamos firma HMAC para asegurar que viene de Apify.
 *
 * Acciones por estado:
 *  - SUCCEEDED → leemos dataset, importamos a contactos, ajustamos costo
 *    real (reintegramos diferencia si vinieron menos items que el máximo).
 *  - FAILED / ABORTED → reintegramos TODOS los créditos cobrados.
 */
export async function POST(req: NextRequest) {
  // Body crudo para verificar HMAC ANTES de parsear como JSON.
  const rawBody = await req.text();
  const firma = req.headers.get("apify-webhook-signature");

  if (!verificarFirmaWebhook(rawBody, firma)) {
    console.warn("[apify:webhook] firma inválida");
    return NextResponse.json({ error: "firma_invalida" }, { status: 401 });
  }

  let payload: {
    jobIdInterno?: string;
    apifyRunId?: string;
    apifyDatasetId?: string | null;
    estado?: string;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!payload.apifyRunId) {
    return NextResponse.json({ error: "falta_apify_run_id" }, { status: 400 });
  }

  const fila = await obtenerRunApifyPorApifyId(payload.apifyRunId);
  if (!fila) {
    console.warn(
      `[apify:webhook] run ${payload.apifyRunId} no existe en runs_apify (posible delay) — ack OK igual`,
    );
    return NextResponse.json({ ok: true });
  }
  if (fila.estado !== "corriendo") {
    // Idempotencia: ya lo procesamos.
    return NextResponse.json({ ok: true, ya_procesado: true });
  }

  const ahora = new Date().toISOString();

  if (payload.estado === "SUCCEEDED" && payload.apifyDatasetId) {
    try {
      const def = obtenerDefinicionActor(fila.actor_id);
      const resumen = await importarResultadosRun({
        cuentaId: fila.cuenta_id,
        apifyDatasetId: payload.apifyDatasetId,
        runApifyId: fila.id,
        actorIdInterno: fila.actor_id,
      });

      const itemsReales = resumen.leads_guardados;
      const itemsCobrados = fila.costo_creditos / (def?.creditosPorItem ?? 1);
      // Reintegrar diferencia si vinieron menos resultados que el máximo cobrado.
      if (itemsReales < itemsCobrados && def) {
        const reintegrar = Math.floor(
          (itemsCobrados - itemsReales) * def.creditosPorItem,
        );
        if (reintegrar > 0) {
          await agregarCreditos(fila.cuenta_id, reintegrar);
        }
      }

      await actualizarRunApify(fila.id, {
        estado: "completado",
        apify_dataset_id: payload.apifyDatasetId,
        items_count: itemsReales,
        costo_usd: itemsReales * (def?.costoUsdPorItem ?? 0),
        completado_en: ahora,
      });
      return NextResponse.json({ ok: true, resumen });
    } catch (err) {
      console.error("[apify:webhook] error importando:", err);
      await actualizarRunApify(fila.id, {
        estado: "fallido",
        error: err instanceof Error ? err.message : String(err),
        completado_en: ahora,
      });
      return NextResponse.json(
        { error: "error_importando" },
        { status: 500 },
      );
    }
  }

  // FAILED / ABORTED → reintegrar todo
  await agregarCreditos(fila.cuenta_id, fila.costo_creditos);
  await actualizarRunApify(fila.id, {
    estado: payload.estado === "ABORTED" ? "abortado" : "fallido",
    error: `Apify status: ${payload.estado}`,
    completado_en: ahora,
  });
  return NextResponse.json({ ok: true });
}
