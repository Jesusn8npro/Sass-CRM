import { NextResponse, type NextRequest } from "next/server";
import { streamText, tool, convertToModelMessages, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  actualizarCuenta,
  guardarThreadConfig,
  obtenerCuenta,
  obtenerThreadConfig,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const PROMPT_SISTEMA = `Sos un asistente cálido y conciso que ayuda a configurar un agente de IA para WhatsApp Business.

REGLAS DE CONVERSACIÓN:
- Hacé UNA pregunta por turno. Nunca dos juntas.
- Máximo 2 oraciones por mensaje.
- Español neutro de LATAM (no muy rioplatense, no muy mexicano).
- Si el usuario te da info corta o ambigua ("se llama Carlos"), tomalá igual y avanzá. No pidas perfección.
- Después de CADA tool call exitoso, RESPONDÉ AL USUARIO con la próxima pregunta o un cierre breve.
- Nunca digas "ahora actualizo el campo" o expongas detalles técnicos. Hacelo invisible.

CAMPOS A LLENAR (en orden estricto, uno por turno):

1. **agente_nombre** — Nombre del agente IA. Sugerile 2-3 si pide ayuda (ej: "Sofía", "Mateo", "Lucía").

2. **agente_rol** — Qué rol cumple el agente. Sugerile opciones según el contexto: "Asesor de ventas", "Recepcionista virtual", "Soporte técnico", "Coordinador de citas".

3. **agente_personalidad** — 1-2 frases sobre cómo es. Si el usuario duda, sugerí "Cálida, consultiva y paciente" o "Directa, profesional y resolutiva".

4. **agente_tono** — Elegí UNO de: \`formal\` | \`casual_amigable\` | \`profesional\` | \`cercano\` | \`directo\` | \`consultivo\`. Mostrale 2-3 opciones según lo que dijo antes y dejá que elija.

5. **modo_respuesta** — Elegí UNO de:
   - \`mixto\`: texto principalmente, audio/imágenes ocasionales (recomendado)
   - \`solo_texto\`: nunca audio
   - \`solo_audio\`: siempre nota de voz (requiere voz configurada)
   - \`espejo_voz\`: audio si el cliente mandó audio, texto si escribió
   Explicá brevemente qué significan y dejá que elija.

6. **mensaje_bienvenida** — Primer mensaje que verá un cliente nuevo. Si dudan, ofreceles un draft basado en lo conversado y pedí confirmación.

7. **contexto_negocio** — 1-2 párrafos sobre qué hace el negocio, productos/servicios, público target. Hacé 2-3 sub-preguntas si es necesario antes de armar el texto final con la tool.

CIERRE:
Cuando los 7 campos estén completos, llamá \`finalizar_configuracion\` con un resumen amigable de la config y avisá al usuario que su agente quedó listo y puede ajustar manualmente lo que quiera.

ARRANCÁ saludando al usuario con su primer turno, presentándote en una oración y haciendo la pregunta del campo 1.`;

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

  const body = (await req.json()) as { messages: unknown[] };
  const mensajes = await convertToModelMessages(
    body.messages as Parameters<typeof convertToModelMessages>[0],
  );

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: PROMPT_SISTEMA,
    messages: mensajes,
    // Sin esto, AI SDK 5 corta después del primer tool call y no
    // sigue conversando. Permitimos hasta 20 steps para que el agente
    // llame tool → vea resultado → siga con la próxima pregunta.
    stopWhen: stepCountIs(20),
    tools: {
      actualizar_campo: tool({
        description:
          "Persiste un campo de la configuración del agente. Llamala apenas el usuario te dé un valor claro.",
        inputSchema: z.object({
          campo: z.enum([
            "agente_nombre",
            "agente_rol",
            "agente_personalidad",
            "agente_tono",
            "modo_respuesta",
            "mensaje_bienvenida",
            "contexto_negocio",
          ]),
          valor: z.string().min(1).max(2000),
        }),
        execute: async ({ campo, valor }) => {
          await actualizarCuenta(idCuenta, {
            [campo]: valor,
          } as Parameters<typeof actualizarCuenta>[1]);
          return { ok: true, campo, guardado: valor.slice(0, 60) };
        },
      }),
      finalizar_configuracion: tool({
        description:
          "Marca la config como completa cuando todos los campos están llenados.",
        inputSchema: z.object({
          resumen: z
            .string()
            .describe("Resumen amigable de la config para mostrar al usuario."),
        }),
        execute: async ({ resumen }) => {
          await guardarThreadConfig(idCuenta, { completado: true });
          return { ok: true, resumen };
        },
      }),
    },
    onFinish: async ({ response }) => {
      // Persistimos el thread para retomarlo después.
      const thread = await obtenerThreadConfig(idCuenta);
      const mensajesActuales = thread?.mensajes ?? [];
      const todos = [
        ...mensajesActuales,
        ...(response.messages as Array<{ role: string; content: unknown }>),
      ];
      await guardarThreadConfig(idCuenta, { mensajes: todos });
    },
  });

  return result.toUIMessageStreamResponse();
}
