/**
 * Borrador de seguimiento MANUAL por conversación.
 *
 * A diferencia del auto-seguimiento masivo (procesarAutoSeguimientos), esto
 * lo dispara el dueño a propósito desde el botón "Seguimiento" de UNA
 * conversación. Lee los últimos mensajes de ESA charla y redacta un mensaje
 * para retomarla. NO envía nada — solo devuelve el borrador para que el
 * dueño lo apruebe/edite antes de enviar.
 */
import OpenAI from "openai";
import {
  obtenerCuenta,
  obtenerHistorialReciente,
  registrarUso,
} from "@/lib/baseDatos";
import { db } from "@/lib/db/cliente";
import { conReintentos } from "@/lib/reintentos";

const cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });
const MODELO = "gpt-4o-mini";
const COSTO = { in: 0.15, out: 0.6 };

interface ConvMin {
  id: string;
  telefono: string;
  nombre: string | null;
}

export async function generarBorradorSeguimiento(
  cuentaId: string,
  conversacionId: string,
): Promise<{ ok: boolean; borrador?: string; error?: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Falta configurar OpenAI en el servidor." };
  }

  const { data: convRaw } = await db()
    .from("conversaciones")
    .select("id, telefono, nombre")
    .eq("id", conversacionId)
    .eq("cuenta_id", cuentaId)
    .maybeSingle();
  const conv = convRaw as ConvMin | null;
  if (!conv) return { ok: false, error: "Conversación no encontrada." };

  const cuenta = await obtenerCuenta(cuentaId);
  if (!cuenta) return { ok: false, error: "Cuenta no encontrada." };

  const historial = await obtenerHistorialReciente(conversacionId, 14);
  if (historial.length === 0) {
    return { ok: false, error: "Esta conversación no tiene mensajes para basar el seguimiento." };
  }

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
      return `${quien}: ${(m.contenido ?? "").slice(0, 300)}`;
    })
    .join("\n");

  const nombreCliente = conv.nombre?.trim() || null;

  const systemPrompt = `Sos ${cuenta.agente_nombre || "el agente de ventas"} de "${cuenta.etiqueta}". Tu tono es ${cuenta.agente_tono ?? "casual_amigable"}.

TAREA: redactar UN mensaje de seguimiento breve, humano y natural para retomar esta conversación específica con el cliente. Debe sentirse personal y continuar la charla donde quedó — NO una plantilla.

Reglas:
- Máximo 2 frases (160 caracteres ideal, 280 max).
- Si conocés el nombre del cliente, usalo. Si no, hablá sin nombre — NO inventes uno.
- Hacé referencia al CONTENIDO real de la conversación (lo último que se habló, la duda o decisión pendiente). Nada genérico vacío.
- Sin signos de exclamación múltiples ni emojis decorativos. Un emoji sutil al final está OK.
- No repitas literal lo que ya le dijiste; buscá un ángulo nuevo para reactivar.

Devolvé SOLO el texto del mensaje, sin comillas ni prefijos.`;

  const userPrompt = `Conversación con ${nombreCliente ?? `el cliente +${conv.telefono}`}:

${transcripcion}

Redactá el mensaje de seguimiento para retomar esta charla.`;

  try {
    const respuesta = await conReintentos(
      () =>
        cliente.chat.completions.create({
          model: MODELO,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      { contexto: "seguimientoManual.borrador", maxIntentos: 2, baseMs: 500 },
    );

    if (respuesta.usage) {
      const tIn = respuesta.usage.prompt_tokens ?? 0;
      const tOut = respuesta.usage.completion_tokens ?? 0;
      registrarUso({
        cuenta_id: cuentaId,
        proveedor: "openai",
        modelo: MODELO,
        tokens_in: tIn,
        tokens_out: tOut,
        costo_usd: (tIn * COSTO.in + tOut * COSTO.out) / 1_000_000,
        metadata: { tipo: "seguimiento_manual_borrador" },
      });
    }

    const texto = respuesta.choices[0]?.message?.content?.trim();
    if (!texto || texto.length < 5) {
      return { ok: false, error: "No se pudo generar un borrador. Probá de nuevo." };
    }
    return { ok: true, borrador: texto.replace(/^["']|["']$/g, "").slice(0, 800) };
  } catch {
    return { ok: false, error: "Error generando el borrador. Probá de nuevo en un momento." };
  }
}
