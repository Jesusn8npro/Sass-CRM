/**
 * Procesador periodico que crea seguimientos_programados para
 * conversaciones donde el cliente dejo de responder, segun los
 * pasos configurados en auto_seguimientos_pasos.
 *
 * Flujo de cada conversación:
 *   1. Si el remitente es el OPERADOR PRIVADO de la cuenta → skip
 *      (no le mandamos auto-seguimientos al dueño).
 *   2. Si paso_enviado >= cantidad de pasos → ya se envió todo, skip.
 *   3. Si el último mensaje es del cliente → no toca seguimiento (el
 *      reset lo hace manejador.ts cuando llega el msg).
 *   4. Si transcurrió >= minutos_despues del próximo paso → encolar
 *      seguimiento_programado y avanzar paso_enviado.
 *
 * El TEXTO del seguimiento se genera con IA en base a la conversación
 * real del cliente (gpt-4o-mini, ~$0.0005 por seguimiento). Esto da
 * mensajes humanos y contextuales en vez del template fijo. Si la
 * generación IA falla, se cae al `proximoPaso.mensaje` literal como
 * fallback.
 *
 * NO duplica seguimientos: chequea que no haya uno pendiente para
 * la conv antes de crear.
 */
import OpenAI from "openai";
import { log } from "@/lib/logger";
import {
  avanzarPasoAutoSeguimiento,
  crearSeguimiento,
  listarPasosAutoSeguimiento,
  obtenerCuenta,
  obtenerHistorialReciente,
  registrarUso,
  type Cuenta,
  type PasoAutoSeguimiento,
} from "@/lib/baseDatos";
import { db } from "@/lib/db/cliente";
import { conReintentos } from "@/lib/reintentos";
import { dentroHorarioHumano } from "./procesadores";

interface ConversacionRevisar {
  id: string;
  cuenta_id: string;
  modo: string;
  telefono: string;
  nombre: string | null;
  auto_seg_paso_enviado: number;
  ultimo_mensaje_en: string | null;
}

interface UltimoMensaje {
  rol: string;
  creado_en: string;
}

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});
const MODELO_SEG = "gpt-4o-mini";
const COSTO_SEG = { in: 0.15, out: 0.6 };

function normalizarTel(t: string | null | undefined): string {
  return (t ?? "").replace(/[^0-9]/g, "");
}

export async function procesarAutoSeguimientos(): Promise<void> {
  if (!dentroHorarioHumano()) return;

  // Cuentas con la feature activa
  const { data: cuentas, error: errC } = await db()
    .from("cuentas")
    .select("id, telefono_operador_privado")
    .eq("auto_seguimiento_activo", true)
    .eq("esta_activa", true)
    .eq("esta_archivada", false);
  if (errC || !cuentas || cuentas.length === 0) return;

  type FilaCuenta = { id: string; telefono_operador_privado: string | null };
  const cuentasArr = cuentas as FilaCuenta[];

  // Cache de pasos por cuenta + teléfono operador para filtrar
  const pasosPorCuenta = new Map<string, PasoAutoSeguimiento[]>();
  const operadorPorCuenta = new Map<string, string>();
  for (const c of cuentasArr) {
    const pasos = await listarPasosAutoSeguimiento(c.id);
    if (pasos.length > 0) pasosPorCuenta.set(c.id, pasos);
    operadorPorCuenta.set(c.id, normalizarTel(c.telefono_operador_privado));
  }
  if (pasosPorCuenta.size === 0) return;

  const idsCuentas = Array.from(pasosPorCuenta.keys());

  // Conversaciones candidatas: en modo IA, no archivadas, con al
  // menos un mensaje, y que aún no llegaron al último paso configurado.
  const { data: convsRaw } = await db()
    .from("conversaciones")
    .select(
      "id, cuenta_id, modo, telefono, nombre, auto_seg_paso_enviado, ultimo_mensaje_en",
    )
    .in("cuenta_id", idsCuentas)
    .eq("modo", "IA")
    .not("ultimo_mensaje_en", "is", null);

  const convs = (convsRaw ?? []) as ConversacionRevisar[];
  if (convs.length === 0) return;

  for (const conv of convs) {
    try {
      // Excluir al operador privado — su número NO debe recibir
      // auto-seguimientos genéricos (es el dueño, no un cliente).
      const telOperador = operadorPorCuenta.get(conv.cuenta_id) ?? "";
      const telConv = normalizarTel(conv.telefono);
      if (
        telOperador.length >= 8 &&
        (telConv === telOperador ||
          telConv.endsWith(telOperador) ||
          telOperador.endsWith(telConv))
      ) {
        continue; // skip operador privado
      }

      await tratarConversacion(conv, pasosPorCuenta.get(conv.cuenta_id)!);
    } catch (err) {
      log.error({ err, convId: conv.id }, "[autoSeg] error procesando conv");
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

  // Último mensaje de la conv: si es del usuario, no es momento de
  // seguimiento (el reset debería haber pasado en manejador.ts).
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
    if (conv.auto_seg_paso_enviado > 0) {
      await avanzarPasoAutoSeguimiento(conv.id, 0);
    }
    return;
  }

  const transcurridoMs = Date.now() - new Date(u.creado_en).getTime();
  const requiereMs = proximoPaso.minutos_despues * 60_000;
  if (transcurridoMs < requiereMs) return;

  // No duplicar
  const { data: pendiente } = await db()
    .from("seguimientos_programados")
    .select("id")
    .eq("conversacion_id", conv.id)
    .eq("estado", "pendiente")
    .limit(1)
    .maybeSingle();
  if (pendiente) return;

  // Generar el texto del seguimiento — IA contextual con fallback al
  // template literal del paso si la IA falla.
  const cuenta = await obtenerCuenta(conv.cuenta_id);
  const textoSeguimiento = await generarTextoSeguimientoConIA(
    cuenta,
    conv,
    proximoPaso,
  );

  const programadoPara = new Date(Date.now() + 30_000).toISOString();
  await crearSeguimiento(
    conv.cuenta_id,
    conv.id,
    textoSeguimiento,
    programadoPara,
    "ia",
  );

  await avanzarPasoAutoSeguimiento(
    conv.id,
    conv.auto_seg_paso_enviado + 1,
  );

  log.info(
    { convId: conv.id, orden: proximoPaso.orden, total: pasos.length, chars: textoSeguimiento.length },
    "[autoSeg] paso agendado",
  );
}

/**
 * Genera el texto del seguimiento con gpt-4o-mini en base al historial
 * de la conversación. Usa el `mensaje` del paso como GUÍA de intención
 * (no como texto literal). Si OpenAI no está configurado o falla, cae
 * al texto literal del paso como fallback.
 */
async function generarTextoSeguimientoConIA(
  cuenta: Cuenta | null,
  conv: ConversacionRevisar,
  paso: PasoAutoSeguimiento,
): Promise<string> {
  if (!cuenta || !process.env.OPENAI_API_KEY) {
    return paso.mensaje;
  }

  try {
    const historial = await obtenerHistorialReciente(conv.id, 12);
    if (historial.length === 0) return paso.mensaje;

    const transcripcion = historial
      .map((m) => {
        const quien =
          m.rol === "usuario"
            ? "Cliente"
            : m.rol === "asistente"
              ? "Agente"
              : m.rol === "humano"
                ? "Operador"
                : "Sistema";
        const t = (m.contenido ?? "").slice(0, 300);
        return `${quien}: ${t}`;
      })
      .join("\n");

    const nombreCliente = conv.nombre?.trim() || null;

    const systemPrompt = `Sos ${cuenta.agente_nombre || "el agente de ventas"} de "${cuenta.etiqueta}". Tu tono es ${cuenta.agente_tono ?? "casual_amigable"}.

TAREA: generar un MENSAJE DE SEGUIMIENTO breve, humano y natural para retomar una conversación con un cliente que dejó de responder. Debe sentirse como un mensaje nuevo y personal — NO como una plantilla automática.

Reglas:
- Máximo 2 frases (160 caracteres ideal, 280 max).
- Si conocés el nombre del cliente, usalo. Si no, hablá sin nombre — NO inventes uno.
- Hacé referencia al CONTENIDO real de la conversación previa (producto que preguntó, decisión pendiente, próximo paso que quedó). NO uses frases genéricas vacías como "¿pudiste verlo?" sin más contexto.
- NO uses signos de exclamación múltiples ni emojis decorativos. Un emoji sutil al final está OK (🙂, 👍).
- NO repitas literalmente lo que ya le dijiste antes — buscá un ángulo nuevo.
- Tono natural, como si lo escribieras vos.

INTENCIÓN del seguimiento (esta es la GUÍA del operador, NO la copies literal — usala como dirección):
"${paso.mensaje}"

Devolvé SOLO el texto del mensaje, sin comillas, sin prefijos como "Mensaje:". Solo el contenido tal como lo recibiría el cliente.`;

    const userPrompt = `Conversación previa con ${nombreCliente ?? `el cliente +${conv.telefono}`}:

${transcripcion}

(El cliente no respondió hace ${paso.minutos_despues} minutos. Generá el mensaje de seguimiento.)`;

    const respuesta = await conReintentos(
      () =>
        cliente.chat.completions.create({
          model: MODELO_SEG,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      { contexto: "autoSeg.generar", maxIntentos: 2, baseMs: 500 },
    );

    if (respuesta.usage) {
      const tIn = respuesta.usage.prompt_tokens ?? 0;
      const tOut = respuesta.usage.completion_tokens ?? 0;
      registrarUso({
        cuenta_id: conv.cuenta_id,
        proveedor: "openai",
        modelo: MODELO_SEG,
        tokens_in: tIn,
        tokens_out: tOut,
        costo_usd: (tIn * COSTO_SEG.in + tOut * COSTO_SEG.out) / 1_000_000,
        metadata: { tipo: "auto_seguimiento_ia" },
      });
    }

    const texto = respuesta.choices[0]?.message?.content?.trim();
    if (!texto || texto.length < 5) {
      return paso.mensaje; // fallback al template
    }
    // Cap defensivo + sanitizar comillas dobles que la IA a veces agrega
    return texto.replace(/^["']|["']$/g, "").slice(0, 800);
  } catch (err) {
    log.warn({ err, convId: conv.id }, "[autoSeg] IA falló, usando texto literal del paso");
    return paso.mensaje;
  }
}
