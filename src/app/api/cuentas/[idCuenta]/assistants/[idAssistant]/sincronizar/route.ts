import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarAssistantLocal,
  actualizarCuenta,
  listarBiblioteca,
  listarConocimientoDeCuenta,
  listarProductosActivos,
  obtenerAssistantLocal,
  obtenerCuenta,
} from "@/lib/baseDatos";
import {
  actualizarAssistant,
  crearAssistant,
  obtenerAssistant as obtenerAssistantVapi,
} from "@/lib/vapi";
import { construirPromptSistema } from "@/lib/construirPrompt";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idAssistant: string }>;
}

function urlPublica(req: NextRequest): string {
  const desdeEnv = process.env.VAPI_PUBLIC_URL;
  if (desdeEnv && desdeEnv.startsWith("http")) {
    return desdeEnv.replace(/\/$/, "");
  }
  return req.nextUrl.origin.replace(/\/$/, "");
}

const PROMPT_LLAMADA_EXTRA = `

INSTRUCCIONES ADICIONALES — ESTÁS EN UNA LLAMADA DE VOZ:
- Hablás por teléfono. Sé concreto y conversacional. Frases cortas.
- NO uses formato markdown, listas con guiones, asteriscos, ni emojis.
- Cuando te den un email, REPETILO en voz alta letra por letra para
  confirmarlo: "te repito, es jota-u-a-ene arroba ge-eme-a-i-ele punto
  ce-o-eme, ¿correcto?". Si suena raro o le faltan caracteres, pedí
  que lo deletree de nuevo.
- Cuando te den teléfono o números importantes, también confirmá
  repitiendo dígito por dígito.
- Si el cliente no responde por 8 segundos, preguntale si me escucha.
- Si el cliente pide hablar con un humano, decile que vas a tomar nota
  y que un asesor lo va a llamar de vuelta.
- Cierre amable y breve cuando termines.`;

/**
 * Sincroniza UN assistant específico contra Vapi (POST si no existe,
 * PATCH si ya existe). Usa el prompt + contexto de la cuenta + el
 * prompt_extra y primer_mensaje propios del assistant.
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idAssistant } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const assistant = await obtenerAssistantLocal(idAssistant);
  if (!assistant || assistant.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Assistant no encontrado" },
      { status: 404 },
    );
  }
  if (!cuenta.vapi_api_key?.trim()) {
    return NextResponse.json(
      { error: "Falta API key de Vapi en esta cuenta." },
      { status: 400 },
    );
  }
  const vozId = (assistant.voz_elevenlabs || cuenta.voz_elevenlabs)?.trim();
  if (!vozId) {
    return NextResponse.json(
      {
        error:
          "Falta Voice ID de ElevenLabs (en este assistant o en la cuenta).",
      },
      { status: 400 },
    );
  }

  const conocimiento = await listarConocimientoDeCuenta(idCuenta);
  const biblioteca = await listarBiblioteca(idCuenta);
  const productos = await listarProductosActivos(idCuenta);
  const promptBase = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
    productos,
  );
  const promptExtra = assistant.prompt_extra?.trim()
    ? `\n\nINSTRUCCIONES ESPECÍFICAS DE ESTE ASSISTANT:\n${assistant.prompt_extra.trim()}`
    : "";
  const promptCompleto = promptBase + PROMPT_LLAMADA_EXTRA + promptExtra;

  // Webhook secret reusa el de la cuenta (si no hay, lo creamos).
  let secret = cuenta.vapi_webhook_secret;
  if (!secret) {
    secret = crypto.randomBytes(24).toString("hex");
    await actualizarCuenta(idCuenta, { vapi_webhook_secret: secret });
  }
  const baseUrl = urlPublica(req);
  const webhookUrl = `${baseUrl}/api/vapi/webhook`;

  const primerMensajeBase = assistant.primer_mensaje?.trim()
    ? assistant.primer_mensaje.trim()
    : `Hola, te llamo de ${cuenta.etiqueta}. ¿Tenés un momento?`;

  const opciones = {
    nombre: `${cuenta.etiqueta} — ${assistant.nombre}`,
    systemPrompt: promptCompleto,
    primerMensaje: primerMensajeBase,
    modelo: assistant.modelo || "gpt-4o-mini",
    vozId,
    serverUrl: webhookUrl,
    serverUrlSecret: secret,
    maxSegundos: assistant.max_segundos,
    grabar: assistant.grabar,
  };

  try {
    let vapiId = assistant.vapi_assistant_id;
    let creado = false;

    if (vapiId) {
      try {
        await obtenerAssistantVapi(cuenta.vapi_api_key, vapiId);
      } catch {
        vapiId = null; // ya no existe en Vapi
      }
    }

    if (vapiId) {
      const r = await actualizarAssistant(cuenta.vapi_api_key, vapiId, opciones);
      vapiId = r.id;
    } else {
      const r = await crearAssistant(cuenta.vapi_api_key, opciones);
      vapiId = r.id;
      creado = true;
    }

    const actualizado = await actualizarAssistantLocal(idAssistant, {
      vapi_assistant_id: vapiId,
      sincronizado_en: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      creado,
      assistant: actualizado,
      webhook_url: webhookUrl,
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 600) },
      { status: 502 },
    );
  }
}
