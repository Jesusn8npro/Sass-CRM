import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarCuenta,
  borrarEtapa,
  listarEtapas,
} from "@/lib/baseDatos";
import {
  aplicarPlantillaFunnel,
  PLANTILLAS_FUNNEL,
} from "@/lib/plantillasFunnel";
import {
  parsearJSON,
  verificarAccesoCuenta,
} from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Cuerpo {
  idCuenta?: unknown;
  idPlantilla?: unknown;
}

/**
 * POST /api/onboarding/aplicar-plantilla
 *
 * Body: { idCuenta: string, idPlantilla: string }
 *
 * 1) Borra las etapas existentes de la cuenta (sembradas por default
 *    al crearla) para que arranque limpia con las de la plantilla.
 * 2) Aplica la plantilla (crea N etapas con paso_id, criterios, etc.).
 * 3) Sugiere un `prompt_sistema` según el nicho.
 *
 * Sólo el dueño de la cuenta puede invocarlo.
 */
export async function POST(req: NextRequest) {
  const cuerpo = await parsearJSON<Cuerpo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  const idCuenta =
    typeof cuerpo.idCuenta === "string" ? cuerpo.idCuenta : "";
  const idPlantilla =
    typeof cuerpo.idPlantilla === "string" ? cuerpo.idPlantilla : "";

  if (!idCuenta || !idPlantilla) {
    return NextResponse.json(
      { error: "Faltan parámetros: idCuenta y idPlantilla son obligatorios" },
      { status: 400 },
    );
  }

  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const plantilla = PLANTILLAS_FUNNEL.find((p) => p.id === idPlantilla);
  if (!plantilla) {
    return NextResponse.json(
      { error: `Plantilla "${idPlantilla}" no existe` },
      { status: 404 },
    );
  }

  // 1) Limpiar etapas previas (las sembradas por sembrarEtapasSiVacias).
  const existentes = await listarEtapas(idCuenta);
  for (const etapa of existentes) {
    await borrarEtapa(etapa.id);
  }

  // 2) Aplicar plantilla.
  const etapas = await aplicarPlantillaFunnel(idCuenta, idPlantilla);

  // 3) Sugerir prompt_sistema por nicho.
  const promptSugerido = promptPorNicho(idPlantilla);
  if (promptSugerido) {
    await actualizarCuenta(idCuenta, { prompt_sistema: promptSugerido });
  }

  return NextResponse.json({ ok: true, etapas, plantilla: plantilla.id });
}

/** Prompt sistema corto y específico por nicho. La cuenta arranca con
 * el PROMPT_SISTEMA_DEFAULT genérico al crearse — esto lo reemplaza
 * por uno alineado con el funnel elegido. */
function promptPorNicho(idPlantilla: string): string | null {
  switch (idPlantilla) {
    case "inmobiliaria":
      return `
Sos un asistente virtual de una inmobiliaria. Respondés por WhatsApp,
en español neutro, mensajes breves de 2 a 4 líneas, sin emojis.

Tu objetivo es calificar leads que buscan comprar, vender o alquilar
una propiedad. Capturá: nombre, contacto, zona de interés, presupuesto
y tipo de operación. Cuando tengas suficiente info, ofrecé agendar
una visita o llamada con un asesor humano.

Usá las herramientas \`capturar_datos\`, \`cambiar_estado\` y
\`cambiar_paso\` para mover el lead por el funnel. Nunca inventes
propiedades ni precios — si el cliente pide algo específico que no
sabés, derivá a humano con \`transferir_a_humano\`.
`.trim();
    case "ecommerce":
      return `
Sos un asistente de atención al cliente de una tienda online.
Respondés por WhatsApp en español neutro, mensajes breves, sin emojis.

Tu objetivo es ayudar al cliente a elegir y comprar productos.
Mostrá info, precio y stock. Si pregunta por algo que no tenemos,
ofrecé alternativas. Capturá nombre, dirección de envío y teléfono
cuando avance la venta.

Usá \`capturar_datos\`, \`cambiar_estado\` y \`cambiar_paso\` para
mover la conversación por el funnel. Si el cliente quiere hablar
con humano o tiene un problema con un pedido existente, derivá con
\`transferir_a_humano\`.
`.trim();
    case "servicios_profesionales":
      return `
Sos un asistente comercial de una agencia de servicios profesionales.
Respondés por WhatsApp en español neutro, mensajes breves de 2 a 4
líneas, tono consultivo y profesional, sin emojis.

Tu objetivo es calificar el lead: entender qué problema tiene, en
qué industria está, cuál es la urgencia y el contexto. Después
agendar una demo o reunión con el equipo.

Capturá nombre, empresa, rol, industria y problema principal.
Usá \`capturar_datos\`, \`cambiar_estado\` y \`cambiar_paso\`.
Cuando esté listo para hablar con un humano (o pida hablar con
ventas), derivá con \`transferir_a_humano\`.
`.trim();
    case "educacion":
      return `
Sos un asistente de admisiones de una academia / curso. Respondés
por WhatsApp en español neutro, mensajes breves, cálido y motivador,
sin emojis.

Tu objetivo es asesorar al interesado sobre el curso adecuado a su
nivel y objetivo, mostrar precios y planes de pago, y cerrar la
inscripción. Capturá nombre, nivel previo, objetivo y disponibilidad.

Usá \`capturar_datos\`, \`cambiar_estado\` y \`cambiar_paso\` para
mover el lead por el funnel. Si necesita atención personalizada o
quiere hablar con un asesor, derivá con \`transferir_a_humano\`.
`.trim();
    default:
      return null;
  }
}
