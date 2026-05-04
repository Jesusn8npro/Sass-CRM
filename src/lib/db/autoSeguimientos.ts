/**
 * CRUD de pasos de auto-seguimiento por cuenta.
 *
 * Cada paso = "esperar X minutos desde el último mensaje del bot,
 * mandar este texto si el cliente no respondió".
 */
import { db, lanzar } from "./cliente";

export interface PasoAutoSeguimiento {
  id: string;
  cuenta_id: string;
  orden: number;
  minutos_despues: number;
  mensaje: string;
  creado_en: string;
}

export interface InputPaso {
  orden: number;
  minutos_despues: number;
  mensaje: string;
}

export async function listarPasosAutoSeguimiento(
  cuentaId: string,
): Promise<PasoAutoSeguimiento[]> {
  const { data, error } = await db()
    .from("auto_seguimientos_pasos")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("orden", { ascending: true });
  if (error) lanzar(error, "listarPasosAutoSeguimiento");
  return (data ?? []) as PasoAutoSeguimiento[];
}

/**
 * Reemplaza TODOS los pasos de la cuenta por la lista nueva. Patron
 * "borra y reinserta" en transaccion implicita — mas simple que
 * trackear diff por id, y la cantidad de pasos por cuenta es chica
 * (típicamente 1-5).
 */
export async function reemplazarPasosAutoSeguimiento(
  cuentaId: string,
  pasos: InputPaso[],
): Promise<void> {
  // Validacion mínima
  for (const p of pasos) {
    if (p.minutos_despues < 1 || p.minutos_despues > 60 * 24 * 30) {
      throw new Error(
        `[autoSeg] minutos_despues invalido (${p.minutos_despues}). Permitido 1 a 43200 (30 días).`,
      );
    }
    if (!p.mensaje?.trim() || p.mensaje.length > 2000) {
      throw new Error(
        `[autoSeg] mensaje invalido en paso ${p.orden} (1-2000 chars).`,
      );
    }
  }

  // Borrar todos
  const { error: errDel } = await db()
    .from("auto_seguimientos_pasos")
    .delete()
    .eq("cuenta_id", cuentaId);
  if (errDel) lanzar(errDel, "reemplazarPasosAutoSeguimiento.delete");

  if (pasos.length === 0) return;

  const filas = pasos.map((p, i) => ({
    cuenta_id: cuentaId,
    orden: i + 1, // re-numeramos en orden de entrada para evitar gaps
    minutos_despues: p.minutos_despues,
    mensaje: p.mensaje.trim(),
  }));

  const { error: errIns } = await db()
    .from("auto_seguimientos_pasos")
    .insert(filas);
  if (errIns) lanzar(errIns, "reemplazarPasosAutoSeguimiento.insert");
}

/**
 * Resetea el contador de pasos de una conversacion (cuando el cliente
 * respondió, vuelve al paso 0 para que el ciclo arranque de nuevo si
 * en el futuro el bot manda y el cliente vuelve a callarse).
 */
export async function resetearPasoAutoSeguimiento(
  conversacionId: string,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ auto_seg_paso_enviado: 0 })
    .eq("id", conversacionId)
    .gt("auto_seg_paso_enviado", 0);
  if (error) lanzar(error, "resetearPasoAutoSeguimiento");
}

/**
 * Avanza el contador de paso de una conversacion en +1 (atomico via
 * RPC seria mejor, pero como solo lo llama el procesador single-thread
 * con cache de pasos, un update plano es suficiente).
 */
export async function avanzarPasoAutoSeguimiento(
  conversacionId: string,
  nuevoPaso: number,
): Promise<void> {
  const { error } = await db()
    .from("conversaciones")
    .update({ auto_seg_paso_enviado: nuevoPaso })
    .eq("id", conversacionId);
  if (error) lanzar(error, "avanzarPasoAutoSeguimiento");
}
