/**
 * Memoria a largo plazo del agente — resumen acumulativo.
 *
 * El LLM recibe los últimos N mensajes literales (cuenta.mensajes_contexto).
 * Para preservar contexto de conversaciones largas SIN pagar 50K tokens
 * cada turno, mantenemos un resumen acumulativo en
 * `conversaciones.resumen_contexto` que se actualiza periódicamente con
 * gpt-4o-mini (modelo barato).
 *
 * Estrategia:
 *   - "Ventana" = los últimos N mensajes (van literales al LLM).
 *   - "Cola" = todos los mensajes anteriores a la ventana.
 *   - Cuando la cola crece >10 mensajes desde la última actualización,
 *     se regenera el resumen integrando los mensajes nuevos.
 *   - El resumen se inyecta en el system prompt como bloque "[Memoria
 *     de la conversación previa]: ...".
 *
 * Es fire-and-forget: si falla, se loguea pero no rompe la respuesta
 * al cliente (el agente queda con la ventana N pero sin memoria larga
 * en este turno; en el próximo se intentará de nuevo).
 */
import OpenAI from "openai";
import {
  actualizarResumenContexto,
  obtenerMensajes,
  registrarUso,
  type Conversacion,
  type Cuenta,
  type Mensaje,
} from "./baseDatos";
import { conReintentos } from "./reintentos";

// Umbral de mensajes "viejos" (más allá de la ventana) que disparan
// una actualización. Más alto = menos calls al LLM, resumen más
// stale. 10 es buen balance: cada ~10 turnos del cliente se actualiza.
const UMBRAL_NUEVOS_PARA_RESUMIR = 10;

// Modelo y costo del resumen — siempre el más barato. El resumen
// no exige razonamiento profundo, sólo síntesis.
const MODELO_RESUMEN = "gpt-4o-mini";
const COSTO_RESUMEN_USD_POR_M = { in: 0.15, out: 0.6 };

const cliente = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

/**
 * Disparador principal — chequear y actualizar el resumen si la cola
 * de mensajes "viejos" creció lo suficiente. Llamar fire-and-forget
 * después de generar cada respuesta IA.
 */
export async function actualizarMemoriaSiNecesario(
  conversacion: Conversacion,
  cuenta: Cuenta,
): Promise<void> {
  if (!cuenta.memoria_largo_plazo) return;
  if (!process.env.OPENAI_API_KEY) return;

  try {
    // Traemos hasta 5000 mensajes — suficiente para conversaciones
    // muy largas sin explotar memoria. Más que eso es caso patológico
    // que no querríamos resumir entero igual.
    const todos = await obtenerMensajes(conversacion.id, 5000);
    if (todos.length <= cuenta.mensajes_contexto) return;

    // Cola = mensajes anteriores a la ventana actual.
    const cola = todos.slice(0, todos.length - cuenta.mensajes_contexto);
    if (cola.length === 0) return;

    // Filtramos los que ya fueron resumidos previamente.
    const cortar = conversacion.resumido_hasta_en
      ? new Date(conversacion.resumido_hasta_en).getTime()
      : 0;
    const nuevosParaResumir = cola.filter(
      (m) => new Date(m.creado_en).getTime() > cortar,
    );

    if (nuevosParaResumir.length < UMBRAL_NUEVOS_PARA_RESUMIR) return;

    const resumenPrevio = conversacion.resumen_contexto?.trim() ?? "";
    const nuevoResumen = await generarResumenConIA(
      nuevosParaResumir,
      resumenPrevio,
      cuenta.id,
    );
    if (!nuevoResumen) return;

    const ultimoResumido = nuevosParaResumir[nuevosParaResumir.length - 1]!;
    await actualizarResumenContexto(
      conversacion.id,
      nuevoResumen,
      ultimoResumido.creado_en,
    );
    console.log(
      `[memoria] ✓ resumen actualizado (${nuevosParaResumir.length} msgs nuevos integrados, ${nuevoResumen.length} chars)`,
    );
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error(`[memoria] ✗ no se pudo actualizar resumen: ${detalle}`);
  }
}

/**
 * Llama al LLM (modelo barato) para resumir mensajes preservando lo
 * importante para ventas: datos del cliente, decisiones, productos
 * mencionados, objeciones, próximos pasos. Si ya había un resumen
 * previo, lo recibe y devuelve uno actualizado e integrado.
 */
async function generarResumenConIA(
  mensajesNuevos: Mensaje[],
  resumenPrevio: string,
  cuentaId: string,
): Promise<string | null> {
  const transcripcion = mensajesNuevos
    .map((m) => {
      const quien =
        m.rol === "usuario"
          ? "Cliente"
          : m.rol === "asistente"
            ? "Agente"
            : m.rol === "humano"
              ? "Operador"
              : "Sistema";
      const contenido = (m.contenido || "").slice(0, 500);
      return `${quien}: ${contenido}`;
    })
    .join("\n");

  const promptSistema = `Sos un asistente que mantiene la memoria a largo plazo de una conversación de ventas por WhatsApp.

Tu tarea: producir un resumen BREVE y CONCRETO (máximo 800 caracteres) que preserve TODO lo útil para que un agente comercial pueda retomar la conversación sin perder contexto.

Conservar siempre:
- Datos personales del cliente (nombre, email, teléfono alternativo, ciudad, profesión, etc.)
- Productos / servicios mencionados o de interés
- Precios, presupuestos o condiciones discutidas
- Decisiones tomadas (compró X, agendó cita, descartó Y)
- Objeciones o miedos expresados
- Estado emocional / etapa del lead
- Próximos pasos comprometidos

NO incluir:
- Saludos o cortesías
- Confirmaciones triviales ("ok", "gracias")
- Detalles redundantes

Formato: viñetas cortas. Sin headers. Español neutro.`;

  const promptUsuario = resumenPrevio
    ? `RESUMEN ACTUAL (mensajes anteriores ya resumidos):
${resumenPrevio}

NUEVOS MENSAJES a integrar:
${transcripcion}

Devolvé el RESUMEN ACTUALIZADO (integra lo nuevo, mantené lo viejo si sigue siendo relevante, descartá lo que quedó obsoleto). Máximo 800 caracteres. Sólo el resumen, nada más.`
    : `MENSAJES de la conversación a resumir:
${transcripcion}

Devolvé el resumen siguiendo las instrucciones. Máximo 800 caracteres. Sólo el resumen, nada más.`;

  const inicio = Date.now();
  const respuesta = await conReintentos(
    () =>
      cliente.chat.completions.create({
        model: MODELO_RESUMEN,
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: promptUsuario },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    { contexto: "memoria.resumen", maxIntentos: 2, baseMs: 600 },
  );

  if (respuesta.usage) {
    const tIn = respuesta.usage.prompt_tokens ?? 0;
    const tOut = respuesta.usage.completion_tokens ?? 0;
    registrarUso({
      cuenta_id: cuentaId,
      proveedor: "openai",
      modelo: MODELO_RESUMEN,
      tokens_in: tIn,
      tokens_out: tOut,
      costo_usd:
        (tIn * COSTO_RESUMEN_USD_POR_M.in + tOut * COSTO_RESUMEN_USD_POR_M.out) /
        1_000_000,
      metadata: { tipo: "resumen_memoria" },
    });
  }

  const texto = respuesta.choices[0]?.message?.content?.trim();
  if (!texto) return null;
  console.log(
    `[memoria] resumen generado en ${Date.now() - inicio}ms (${texto.length} chars)`,
  );
  // Cap defensivo por si el LLM se va de largo.
  return texto.slice(0, 1500);
}
