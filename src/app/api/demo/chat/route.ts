import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import { obtenerPlantillaIndustria } from "@/lib/plantillas-industria";
import { verificarRateLimit } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MensajeChat {
  rol: "user" | "assistant";
  contenido: string;
}

interface Cuerpo {
  idIndustria?: unknown;
  historial?: unknown;
  nuevoMensaje?: unknown;
}

const cliente = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" });

/**
 * POST /api/demo/chat
 *
 * Endpoint público (sin sesión). Permite al visitante de la landing
 * probar el agente con la personalidad de una industria.
 *
 * Body: { idIndustria, historial: [{rol, contenido}], nuevoMensaje }
 *
 * Rate limit: 20 mensajes / 5 min por IP (controla abuso de OpenAI).
 */
export async function POST(req: NextRequest) {
  // ---- Rate limit por IP ----
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  const rl = verificarRateLimit(`demo:${ip}`, 20, 300);
  if (rl) return rl;

  // ---- Parseo y validación ----
  let cuerpo: Cuerpo;
  try {
    cuerpo = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const idIndustria =
    typeof cuerpo.idIndustria === "string" ? cuerpo.idIndustria : "";
  const nuevoMensaje =
    typeof cuerpo.nuevoMensaje === "string" ? cuerpo.nuevoMensaje.trim() : "";
  const historialRaw = Array.isArray(cuerpo.historial) ? cuerpo.historial : [];

  if (!idIndustria || !nuevoMensaje) {
    return NextResponse.json(
      { error: "Faltan idIndustria o nuevoMensaje" },
      { status: 400 },
    );
  }
  if (nuevoMensaje.length > 1000) {
    return NextResponse.json(
      { error: "El mensaje es demasiado largo (max 1000 chars)" },
      { status: 400 },
    );
  }

  const plantilla = obtenerPlantillaIndustria(idIndustria);
  if (!plantilla) {
    return NextResponse.json(
      { error: `Industria "${idIndustria}" no existe` },
      { status: 404 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI no configurado en el servidor" },
      { status: 500 },
    );
  }

  // ---- Sanitizar historial ----
  const historial: MensajeChat[] = historialRaw
    .map((m): MensajeChat | null => {
      if (typeof m !== "object" || m === null) return null;
      const obj = m as Record<string, unknown>;
      const rol = obj.rol === "user" || obj.rol === "assistant" ? obj.rol : null;
      const contenido =
        typeof obj.contenido === "string" ? obj.contenido.slice(0, 1000) : null;
      if (!rol || !contenido) return null;
      return { rol, contenido };
    })
    .filter((m): m is MensajeChat => m !== null)
    // Nos quedamos sólo con los últimos 20 turnos para limitar tokens.
    .slice(-20);

  // ---- Catálogo de productos (texto plano para el system prompt) ----
  const catalogoTexto = plantilla.productos_ejemplo
    .map(
      (p) =>
        `- ${p.nombre} (${p.categoria}) — $${p.precio.toLocaleString("es-AR")}\n  ${p.descripcion}`,
    )
    .join("\n");

  const conocimientoTexto = plantilla.conocimiento_inicial
    .map((c) => `- ${c.titulo}\n  ${c.contenido}`)
    .join("\n");

  const systemPrompt = `${plantilla.prompt_sistema}

---
NOTA IMPORTANTE: Sos un demo público de prueba. Si el cliente pregunta por precios o disponibilidad reales, aclarale que sos un agente de prueba y mostrale los productos del catálogo de ejemplo. No tomes datos reales (DNI, tarjetas, direcciones reales) — si los da, ignoralos y aclarale que es un demo.

CATÁLOGO DE EJEMPLO:
${catalogoTexto}

PREGUNTAS FRECUENTES:
${conocimientoTexto}`;

  // ---- Llamada a OpenAI (sin tools, simple chat completion) ----
  try {
    const respuesta = await cliente.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historial.map((m) => ({
          role: m.rol === "user" ? ("user" as const) : ("assistant" as const),
          content: m.contenido,
        })),
        { role: "user", content: nuevoMensaje },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const texto =
      respuesta.choices[0]?.message?.content?.trim() ??
      "Disculpá, no pude generar una respuesta. Probá de nuevo.";

    return NextResponse.json({ respuesta: texto });
  } catch (err) {
    console.error("[demo/chat] error OpenAI:", err);
    return NextResponse.json(
      { error: "No pudimos generar la respuesta. Probá en un rato." },
      { status: 502 },
    );
  }
}
