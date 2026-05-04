/**
 * Procesador periodico que crea seguimientos_programados para
 * conversaciones donde el cliente dejo de responder, segun los
 * pasos configurados en auto_seguimientos_pasos.
 *
 * Logica de cada conversacion:
 *   1. Obtener pasos ordenados de la cuenta (cache).
 *   2. Si paso_enviado >= cantidad de pasos → ya se mando todo, skip.
 *   3. Mirar el ultimo mensaje de la conv:
 *      - si es del usuario → no toca seguimiento (el reset lo hace
 *        manejador.ts cuando llega el msg)
 *      - si es del bot/humano → ver cuanto tiempo paso desde ese msg
 *   4. Si pasaron >= minutos_despues del proximo paso → encolar
 *      seguimiento_programado y avanzar paso_enviado.
 *
 * NO duplica seguimientos: chequea que no haya uno pendiente para
 * la conv antes de crear.
 */
import {
  avanzarPasoAutoSeguimiento,
  crearSeguimiento,
  listarPasosAutoSeguimiento,
  type PasoAutoSeguimiento,
} from "@/lib/baseDatos";
import { db } from "@/lib/db/cliente";
import { dentroHorarioHumano } from "./procesadores";

interface ConversacionRevisar {
  id: string;
  cuenta_id: string;
  modo: string;
  auto_seg_paso_enviado: number;
  ultimo_mensaje_en: string | null;
}

interface UltimoMensaje {
  rol: string;
  creado_en: string;
}

export async function procesarAutoSeguimientos(): Promise<void> {
  if (!dentroHorarioHumano()) return;

  // Cuentas con la feature activa
  const { data: cuentas, error: errC } = await db()
    .from("cuentas")
    .select("id")
    .eq("auto_seguimiento_activo", true)
    .eq("esta_activa", true)
    .eq("esta_archivada", false);
  if (errC || !cuentas || cuentas.length === 0) return;

  // Cache de pasos por cuenta
  const pasosPorCuenta = new Map<string, PasoAutoSeguimiento[]>();
  for (const c of cuentas as Array<{ id: string }>) {
    const pasos = await listarPasosAutoSeguimiento(c.id);
    if (pasos.length > 0) pasosPorCuenta.set(c.id, pasos);
  }
  if (pasosPorCuenta.size === 0) return;

  const idsCuentas = Array.from(pasosPorCuenta.keys());

  // Conversaciones candidatas: en modo IA, no archivadas, con al
  // menos un mensaje, y que aún no llegaron al último paso configurado.
  // Filtramos en memoria para evitar query complejo.
  const { data: convsRaw } = await db()
    .from("conversaciones")
    .select("id, cuenta_id, modo, auto_seg_paso_enviado, ultimo_mensaje_en")
    .in("cuenta_id", idsCuentas)
    .eq("modo", "IA")
    .not("ultimo_mensaje_en", "is", null);

  const convs = (convsRaw ?? []) as ConversacionRevisar[];
  if (convs.length === 0) return;

  for (const conv of convs) {
    try {
      await tratarConversacion(conv, pasosPorCuenta.get(conv.cuenta_id)!);
    } catch (err) {
      console.error(
        `[autoSeg] error procesando conv ${conv.id}:`,
        err,
      );
    }
  }
}

async function tratarConversacion(
  conv: ConversacionRevisar,
  pasos: PasoAutoSeguimiento[],
): Promise<void> {
  // Ya se enviaron todos los pasos
  if (conv.auto_seg_paso_enviado >= pasos.length) return;

  const proximoPaso = pasos[conv.auto_seg_paso_enviado];
  if (!proximoPaso) return;

  // Ultimo mensaje de la conv: si es del usuario, no es momento de
  // seguimiento (el reset deberia haber pasado en manejador.ts pero
  // hay caso borde de double-check).
  const { data: ultimo } = await db()
    .from("mensajes")
    .select("rol, creado_en")
    .eq("conversacion_id", conv.id)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  const u = ultimo as UltimoMensaje | null;
  if (!u) return;
  if (u.rol === "usuario") {
    // Cliente respondio pero el contador no se reseteo aun. Lo hacemos.
    if (conv.auto_seg_paso_enviado > 0) {
      await avanzarPasoAutoSeguimiento(conv.id, 0);
    }
    return;
  }

  // Tiempo desde el último msg del bot/humano
  const transcurridoMs = Date.now() - new Date(u.creado_en).getTime();
  const requiereMs = proximoPaso.minutos_despues * 60_000;
  if (transcurridoMs < requiereMs) return;

  // No duplicar: si ya hay seguimiento pendiente para esta conv, skip
  const { data: pendiente } = await db()
    .from("seguimientos_programados")
    .select("id")
    .eq("conversacion_id", conv.id)
    .eq("estado", "pendiente")
    .limit(1)
    .maybeSingle();
  if (pendiente) return;

  // Encolar — programado para 30 segundos en el futuro (jitter)
  const programadoPara = new Date(Date.now() + 30_000).toISOString();
  await crearSeguimiento(
    conv.cuenta_id,
    conv.id,
    proximoPaso.mensaje,
    programadoPara,
    "ia", // origen: lo agendo el sistema, no el operador
  );

  await avanzarPasoAutoSeguimiento(
    conv.id,
    conv.auto_seg_paso_enviado + 1,
  );

  console.log(
    `[autoSeg] ⏰→ paso ${proximoPaso.orden}/${pasos.length} agendado para conv ${conv.id} (${proximoPaso.minutos_despues} min)`,
  );
}
