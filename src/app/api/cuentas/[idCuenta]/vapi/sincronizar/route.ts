import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  listarBiblioteca,
  listarConocimientoDeCuenta,
  listarProductosActivos,
  obtenerCuenta,
} from "@/lib/baseDatos";
import {
  actualizarAssistant,
  crearAssistant,
  obtenerAssistant,
} from "@/lib/vapi";
import { construirPromptSistema } from "@/lib/construirPrompt";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

function urlPublica(req: NextRequest): string {
  // VAPI_PUBLIC_URL si está seteada (producción/EasyPanel) gana.
  // En dev, usamos el origin del request — pero localhost no le sirve a
  // Vapi para webhooks; tendrás que usar ngrok/cloudflared y pasar la URL.
  const desdeEnv = process.env.VAPI_PUBLIC_URL;
  if (desdeEnv && desdeEnv.startsWith("http")) {
    return desdeEnv.replace(/\/$/, "");
  }
  const origin = req.nextUrl.origin;
  return origin.replace(/\/$/, "");
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
 * Crea o actualiza el assistant de Vapi para esta cuenta usando su
 * prompt + contexto + conocimiento + biblioteca + voz_elevenlabs.
 * Si la cuenta no tiene vapi_assistant_id, lo crea y lo guarda.
 * Si ya tiene, lo actualiza (PATCH).
 */
export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (!cuenta.vapi_api_key?.trim()) {
    return NextResponse.json(
      { error: "Falta API key de Vapi en esta cuenta." },
      { status: 400 },
    );
  }
  if (!cuenta.voz_elevenlabs?.trim()) {
    return NextResponse.json(
      {
        error:
          "Falta Voice ID de ElevenLabs. Configurálo en Ajustes → Voz primero (Vapi usa esa voz).",
      },
      { status: 400 },
    );
  }

  const conocimiento = listarConocimientoDeCuenta(id);
  const biblioteca = listarBiblioteca(id);
  const productos = listarProductosActivos(id);
  const promptBase = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
    productos,
  );
  // Append: instrucciones genéricas de llamada + las custom de la cuenta.
  const promptExtra = cuenta.vapi_prompt_extra?.trim()
    ? `\n\nINSTRUCCIONES ESPECÍFICAS DE ESTE NEGOCIO PARA LLAMADAS:\n${cuenta.vapi_prompt_extra.trim()}`
    : "";
  const promptCompleto = promptBase + PROMPT_LLAMADA_EXTRA + promptExtra;

  // Generar/recuperar webhook secret
  let secret = cuenta.vapi_webhook_secret;
  if (!secret) {
    secret = crypto.randomBytes(24).toString("hex");
    actualizarCuenta(id, { vapi_webhook_secret: secret });
  }
  const baseUrl = urlPublica(req);
  const webhookUrl = `${baseUrl}/api/vapi/webhook`;

  // Primer mensaje custom o default.
  const primerMensajeBase = cuenta.vapi_primer_mensaje?.trim()
    ? cuenta.vapi_primer_mensaje.trim()
    : `Hola, te llamo de ${cuenta.etiqueta}. ¿Tenés un momento?`;

  const opciones = {
    nombre: `${cuenta.etiqueta} (cuenta ${id})`,
    systemPrompt: promptCompleto,
    primerMensaje: primerMensajeBase,
    modelo: cuenta.modelo?.trim() || "gpt-4o-mini",
    vozId: cuenta.voz_elevenlabs.trim(),
    serverUrl: webhookUrl,
    serverUrlSecret: secret,
    maxSegundos: cuenta.vapi_max_segundos ?? 600,
    grabar: cuenta.vapi_grabar !== 0,
  };

  try {
    let assistantId = cuenta.vapi_assistant_id;
    let creado = false;

    if (assistantId) {
      // Si el ID guardado ya no existe en Vapi (la borraron), creamos uno nuevo.
      try {
        await obtenerAssistant(cuenta.vapi_api_key, assistantId);
      } catch {
        assistantId = null;
      }
    }

    if (assistantId) {
      const r = await actualizarAssistant(
        cuenta.vapi_api_key,
        assistantId,
        opciones,
      );
      assistantId = r.id;
    } else {
      const r = await crearAssistant(cuenta.vapi_api_key, opciones);
      assistantId = r.id;
      creado = true;
    }

    actualizarCuenta(id, {
      vapi_assistant_id: assistantId,
      vapi_sincronizado_en: Math.floor(Date.now() / 1000),
    });

    return NextResponse.json({
      ok: true,
      creado,
      assistant_id: assistantId,
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
