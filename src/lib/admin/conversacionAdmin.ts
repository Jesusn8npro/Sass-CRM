/**
 * Motor de conversación natural del Patrón con el agente admin.
 *
 * Reemplaza al parser de slash commands para entradas que NO matchean
 * un comando conocido. Usa Claude Haiku 4.5 con tool calling para
 * interpretar el lenguaje natural y ejecutar herramientas.
 *
 * Memoria: carga últimos 20 mensajes de texto de la conversación admin
 * y los pasa como historial. Claude tiene 200K tokens de contexto, así
 * que ni cerca del límite.
 *
 * El system prompt define el tono: Claude llama al usuario "Patrón" o
 * "Líder", es directo, eficiente, pide confirmación para acciones
 * destructivas (publicar artículos, pausar cuentas).
 */
import {
  obtenerHistorialReciente,
  type Mensaje,
  type SuperAdmin,
} from "@/lib/baseDatos";
import {
  conversarConHerramientas,
  type MensajeClaude,
  type ResultadoConversacion,
} from "@/lib/anthropic";
import { construirHerramientasAdmin } from "./herramientas";

const SYSTEM_PROMPT_ADMIN = `Sos el asistente personal del LÍDER del SaaS Sass-CRM.

Te dirigís a él como "Patrón" o "Líder" en tono respetuoso pero cercano.
Sos directo y eficiente — su tiempo vale oro. No saludes en cada mensaje,
no hagas preámbulos largos, ve al grano.

CONTEXTO DEL NEGOCIO:
Sass-CRM es un SaaS multi-tenant que conecta números de WhatsApp Business
a un agente IA. Sus clientes son PYMEs y agencias en Latinoamérica que
usan el sistema para automatizar ventas y atención. El Patrón es Jesús
González (acordeon91@gmail.com, +573123790071), dueño y único super-admin.

CÓMO RESPONDER:
- Mensajes cortos, sin emojis innecesarios (1-2 máximo por respuesta).
- Listas con viñetas cortas cuando hay varios datos.
- Números siempre con separador de miles.
- Si una métrica está mal o sospechosa, comentalo.
- En español neutro (válido para España y Latam).

HERRAMIENTAS:
Tenés acceso a herramientas para consultar métricas, generar artículos
de blog, listar borradores, publicar artículos, buscar clientes. Usalas
cuando aplique. Si la pregunta es pura conversación (saludo, agradecimiento),
respondé sin tools.

ACCIONES DESTRUCTIVAS:
Antes de ejecutar publicar_articulo_blog, SIEMPRE pedí confirmación
explícita al Patrón ("¿Confirmás que publique el artículo X?"). Solo
ejecutá si responde claramente que sí.

Las lecturas (reportes, métricas, listados) no requieren confirmación,
ejecutalas directo.

GENERACIÓN DE ARTÍCULOS:
Tarda 60-120 segundos. Avisale al Patrón que arrancaste antes de
invocar la tool, y comentale qué modo elegiste (auto/rápido/completo).
Si no especifica modo, usá "auto" — la heurística decide bien.

LIMITACIONES:
Si te piden algo que no tenés herramienta para hacer (ej: generar
videos, publicar en redes, llamadas Vapi), decílo honestamente: "Esa
función todavía no está, Patrón — está en el roadmap".`;

/**
 * Procesa un mensaje del super-admin con Claude + herramientas.
 * Devuelve la respuesta lista para mandar por WhatsApp.
 *
 * Si Claude falla (rate limit, key inválida, etc), lanza error — el
 * caller decide si mostrar el error o caer a un fallback.
 */
export async function conversarConAdminNL(params: {
  conversacionId: string;
  textoEntrante: string;
  superAdmin: SuperAdmin;
}): Promise<ResultadoConversacion> {
  const { conversacionId, textoEntrante, superAdmin } = params;

  // 1) Cargar memoria de la conversación (últimos 20 mensajes de texto)
  const recientes = await obtenerHistorialReciente(conversacionId, 20);

  // 2) Convertir a formato Claude. Filtramos:
  //    - mensajes "sistema" (no se mandan al modelo)
  //    - mensajes que no son de texto (audio/imagen — el admin no las usa)
  //    - el ÚLTIMO mensaje si es el que acabamos de procesar (lo agregamos
  //      después manualmente con el texto entrante limpio).
  const historialClaude: MensajeClaude[] = recientes
    .filter((m) => m.rol !== "sistema" && (m.tipo === "texto" || !m.tipo))
    .filter((m) => (m.contenido ?? "").trim().length > 0)
    .map(mensajeAClaude)
    // Si el último mensaje del historial es exactamente el texto entrante
    // del usuario, lo dropeamos porque vamos a agregarlo limpio al final.
    .filter((_, idx, arr) => {
      if (idx !== arr.length - 1) return true;
      const ultimo = arr[idx];
      return !(
        ultimo &&
        ultimo.role === "user" &&
        ultimo.content === textoEntrante
      );
    });

  // Aseguramos que el último mensaje sea el del usuario actual.
  historialClaude.push({ role: "user", content: textoEntrante });

  // 3) Claude requiere que el historial empiece con "user" y alterne.
  //    Si el primer mensaje es "assistant", lo dropeamos (sería respuesta
  //    huérfana sin contexto).
  while (historialClaude[0]?.role === "assistant") historialClaude.shift();

  // 4) Construir herramientas con contexto del admin
  const herramientas = construirHerramientasAdmin({
    superAdminEmail: superAdmin.email,
    superAdminNombre: superAdmin.nombre,
  });

  // 5) Llamar a Claude con tool calling
  const resultado = await conversarConHerramientas(
    SYSTEM_PROMPT_ADMIN,
    historialClaude,
    herramientas,
  );

  return resultado;
}

function mensajeAClaude(m: Mensaje): MensajeClaude {
  return {
    role: m.rol === "usuario" ? "user" : "assistant",
    content: (m.contenido ?? "").slice(0, 4000), // cap defensivo
  };
}
