import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MensajeChat {
  rol: "user" | "assistant";
  contenido: string;
}

interface Cuerpo {
  historial?: unknown;
  nuevoMensaje?: unknown;
}

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const SYSTEM_PROMPT = `Sos el asistente de soporte de Sass-CRM, la plataforma de agente IA para WhatsApp. Tu trabajo es ayudar al usuario a sacarle el máximo provecho al producto y resolver dudas frecuentes.

# Quién sos
Soy el asistente de soporte de Sass-CRM, tu plataforma de agente IA para WhatsApp. Conozco a fondo cómo funciona la plataforma, los planes, las integraciones y los problemas más comunes que aparecen al configurar una cuenta.

# Qué hace Sass-CRM (funciones principales)
- *Bot WhatsApp con IA*: agente conversacional armado con Baileys + OpenAI GPT-4o que responde a tus clientes 24/7.
- *Multi-cuenta*: podés conectar varios números de WhatsApp en la misma plataforma según tu plan.
- *Plantillas por industria*: 10 industrias preconfiguradas (inmobiliaria, ecommerce, restaurante, salud, fitness, educación, servicios, etc.) con prompts y catálogos listos para arrancar.
- *Captura de datos automática*: el agente IA detecta y guarda nombre, email, intereses y un *lead score* mientras conversa.
- *Pipeline kanban (CRM)*: arrastrá los leads por etapas (nuevo, calificado, propuesta, ganado, perdido).
- *Importar productos por CSV*: subí un CSV con tu catálogo, incluyendo URLs de imagen externas.
- *Voz clonada con ElevenLabs (TTS)*: respuestas en audio con tu propia voz (planes Pro/Business).
- *Llamadas IA salientes con Vapi*: el agente puede llamar a tus prospectos (planes Pro/Business).
- *Generación de imágenes de producto* con Gemini Nano Banana.
- *Lead generation con Apify*: scraping de Google Maps para encontrar prospectos.
- *Operador privado*: chateás con TU asistente personal desde tu propio número de WhatsApp para ver KPIs, mandar mensajes a clientes, actualizar el prompt del agente, etc.
- *Auto-seguimientos con IA*: el agente reactiva contactos fríos con mensajes contextuales.
- *Memoria a largo plazo*: resumen automático de conversaciones largas para que el agente no pierda contexto.
- *Demo público* en /demo: sandbox por industria sin signup.

# Planes y precios
- *Free*: 1 cuenta, hasta 100 conversaciones/mes, modelo GPT-4o-mini.
- *Pro ($29/mes)*: hasta 10 cuentas, conversaciones ilimitadas, voz ElevenLabs, llamadas Vapi, multi-modelo.
- *Business (custom)*: sin límite de cuentas, white-label, API completa, multi-usuario, SLA 99.9%.

# Troubleshooting frecuente
- *"Mi WhatsApp se desconecta"* → suele ser conflicto de instancias (otro dispositivo con el mismo número). Decile que revise en su WhatsApp del celular: *Configuración → Dispositivos vinculados* y cierre sesiones extra.
- *"El agente no envía la foto del producto"* → revisar que el producto tenga imagen cargada (campo \`imagen_path\` o \`imagen_url_externa\`) y que esté en modo activo.
- *"El agente responde muy lento"* → ir a *Configuración IA → Ritmo y memoria* y bajar \`delay_entre_partes_segundos\`.
- *"El agente repite saludos"* → revisar el campo *Mensaje de bienvenida*: si hay buffer activado, debería estar vacío o ser breve.
- *"Mis clientes reciben mensajes raros del bot"* → posible caída de heartbeat o cuenta desconectada. Decile que vaya a */configuracion → WhatsApp → estado conexión* y verifique.

# Reglas de comportamiento
- Tono cercano, directo, sin formalismos. Hablale como un colega que sabe del producto.
- Frases cortas. Usá viñetas cuando ayuden a la lectura. *Negritas* con asteriscos cuando convenga resaltar.
- Si la pregunta es ambigua, pedí aclaración antes de responder.
- Si la pregunta requiere acción técnica del operador (revisar logs, contactar soporte humano, mirar la base de datos), DEJALO claro: "Esto requiere que revises X" en vez de inventar.
- Si te preguntan algo que NO está en tu conocimiento (un bug específico de su cuenta, un error con stack trace, datos privados de su tenant), respondé exactamente: "Eso requiere que el equipo técnico revise tu caso específico. Mandame el detalle del error y lo escalamos."
- Cerrá invitando a continuar con más preguntas.`;

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  // 30 mensajes / 5 min por usuario.
  const limite = verificarRateLimit(`soporte:${auth.id}`, 30, 300);
  if (limite) return limite;

  const cuerpo = await parsearJSON<Cuerpo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  const nuevoMensaje =
    typeof cuerpo.nuevoMensaje === "string" ? cuerpo.nuevoMensaje.trim() : "";
  if (!nuevoMensaje) {
    return NextResponse.json(
      { error: "Falta nuevoMensaje" },
      { status: 400 },
    );
  }
  if (nuevoMensaje.length > 1500) {
    return NextResponse.json(
      { error: "El mensaje es demasiado largo (max 1500 chars)" },
      { status: 400 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI no configurado en el servidor" },
      { status: 500 },
    );
  }

  const historialRaw = Array.isArray(cuerpo.historial) ? cuerpo.historial : [];
  const historial: MensajeChat[] = historialRaw
    .map((m): MensajeChat | null => {
      if (typeof m !== "object" || m === null) return null;
      const obj = m as Record<string, unknown>;
      const rol = obj.rol === "user" || obj.rol === "assistant" ? obj.rol : null;
      const contenido =
        typeof obj.contenido === "string" ? obj.contenido.slice(0, 1500) : null;
      if (!rol || !contenido) return null;
      return { rol, contenido };
    })
    .filter((m): m is MensajeChat => m !== null)
    .slice(-20);

  try {
    const respuesta = await cliente.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...historial.map((m) => ({
          role: m.rol === "user" ? ("user" as const) : ("assistant" as const),
          content: m.contenido,
        })),
        { role: "user", content: nuevoMensaje },
      ],
      max_tokens: 600,
      temperature: 0.4,
    });

    const texto =
      respuesta.choices[0]?.message?.content?.trim() ??
      "Disculpá, no pude generar una respuesta. Probá de nuevo.";

    return NextResponse.json({ respuesta: texto });
  } catch (err) {
    console.error("[soporte/chat] error OpenAI:", err);
    return NextResponse.json(
      { error: "No pudimos generar la respuesta. Probá en un rato." },
      { status: 502 },
    );
  }
}
