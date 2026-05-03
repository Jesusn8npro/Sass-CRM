import { NextResponse, type NextRequest } from "next/server";
import { streamText, tool, convertToModelMessages } from "ai";
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

const PROMPT_SISTEMA = `Sos un asistente que ayuda a configurar un agente de IA para WhatsApp.

Tu trabajo: hacer UNA pregunta por vez al usuario para llenar la config del agente.

Hacelo cálido y conciso (máx 2 oraciones por mensaje). En español rioplatense neutro.

Campos a llenar (en este orden):
1. agente_nombre — Nombre del agente IA (ej: "Sofía", "Carlos")
2. agente_rol — Qué rol cumple ("Asesor de ventas", "Recepcionista", "Soporte técnico")
3. agente_personalidad — 1-2 frases sobre cómo es ("Cálida y consultiva", "Directa y profesional")
4. agente_tono — uno de: formal | casual_amigable | profesional | cercano | directo | consultivo
5. modo_respuesta — uno de: mixto | solo_texto | solo_audio | espejo_voz
   * mixto = texto principalmente, audio/imágenes ocasionales
   * solo_texto = nunca audio
   * solo_audio = siempre nota de voz
   * espejo_voz = audio si el cliente mandó audio, texto si escribió
6. mensaje_bienvenida — primer mensaje cuando alguien escribe nuevo
7. contexto_negocio — qué hace el negocio (1-2 párrafos)

Para cada campo, llamá inmediatamente la tool actualizar_campo apenas el usuario te dé info clara. Después pasá al siguiente.

Cuando todos estén completos, llamá la tool finalizar_configuracion y decile al usuario que ya está listo.`;

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
