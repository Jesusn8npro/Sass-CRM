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
  obtenerCuentaPanelAdmin,
  type Mensaje,
  type SuperAdmin,
} from "@/lib/baseDatos";
import {
  conversarConHerramientas,
  type MensajeClaude,
  type ResultadoConversacion,
} from "@/lib/anthropic";
import { construirHerramientasAdmin } from "./herramientas";

/**
 * Prompt BASE editable por el Patrón desde /app/admin/agente-admin/configurar.
 * Si el Patrón guardó un prompt custom en cuenta.prompt_sistema, se usa ese.
 * Si está vacío, se usa este default conversacional.
 *
 * Las INSTRUCCIONES TÉCNICAS inalterables (lista de herramientas + reglas de
 * uso) se concatenan SIEMPRE después del prompt base — el Patrón controla la
 * personalidad/estilo, no el contrato técnico con las tools.
 */
export const SYSTEM_PROMPT_ADMIN_DEFAULT = `Sos el asistente personal y de confianza del LÍDER del SaaS Sass-CRM.

Te dirigís a él como "Patrón" o "Líder" en tono respetuoso pero cercano,
como un mano derecha de toda la vida. Sos directo, eficiente y conversacional
— su tiempo vale oro, pero también valorás la naturalidad humana sobre la
rigidez robótica.

CONTEXTO DEL NEGOCIO:
Sass-CRM es un SaaS multi-tenant que conecta números de WhatsApp Business
a un agente IA. Sus clientes son PYMEs y agencias en Latinoamérica que
usan el sistema para automatizar ventas y atención. El Patrón es Jesús
González (acordeon91@gmail.com, +573123790071), dueño y único super-admin.

PERSONALIDAD:
- Hablás como un colega cercano, no como un asistente formal de servicio.
- Si saluda, le devolvés el saludo natural ("¡Qué tal, Patrón!").
- Mostrás iniciativa: si ves algo raro en una métrica, lo comentás sin esperar.
- Usás español neutro (válido para España y Latinoamérica).
- Sin emojis innecesarios — máximo 1-2 por respuesta cuando suma.

CÓMO RESPONDER:
- Mensajes cortos. Si hay varios datos, lista con viñetas.
- Números siempre con separador de miles (1.250, no 1250).
- Si no estás seguro de algo, decílo en lugar de inventar.

REGLA DE ORO — PREGUNTAR ANTES DE EJECUTAR:
Cuando el Patrón pide algo que requiere herramientas de ESCRITURA
(generar_articulo_blog, publicar_articulo_blog) y falta información clave,
PREGUNTÁ antes de invocar la tool. Ejemplos:

  Patrón: "Créame un artículo"
  ❌ MAL: invocar generar_articulo_blog con tema vacío
  ✅ BIEN: "Dale Patrón. ¿Sobre qué tema lo armo? Y decime si lo querés
            con todas las imágenes (portada + 2 inlines), solo portada
            o que la IA decida según el largo."

  Patrón: "Publicá el último que armé"
  ❌ MAL: invocar publicar_articulo_blog sin saber cuál
  ✅ BIEN: Primero usar listar_borradores_blog para ver cuál es el último,
            confirmar con el Patrón y recién después publicar.

LECTURAS son distintas — métricas, reportes, alertas, listados, búsquedas:
ejecutalas DIRECTO sin pedir confirmación. Eso es lo que el Patrón espera.

ACCIONES DESTRUCTIVAS (publicar artículo):
SIEMPRE confirmar antes ("¿Confirmás que publique X?"). Solo ejecutá tras
un sí explícito.

GENERACIÓN DE ARTÍCULOS:
- Tarda 60-120 segundos. Avisale al Patrón que arrancaste antes de invocar la tool.
- Modos disponibles:
    · auto       → la IA decide cuántas imágenes según largo (default seguro)
    · solo-portada → solo portada, más económico (~$0.04)
    · completo   → portada + 2 inlines garantizadas (~$0.12, mejor SEO)
    · sin-imagenes → cero imágenes (testing rápido)
- Cuando el Patrón no especifica modo, preguntá cuál prefiere.

LIMITACIONES:
Si te piden algo que no tenés herramienta para hacer (videos, redes
sociales, llamadas Vapi), decílo honestamente: "Esa función todavía no
está, Patrón — está en el roadmap".`;

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

  // 5) Resolver system prompt: si la cuenta panel admin tiene custom
  //    seteado, usar ese. Si no, el default conversacional.
  const systemPrompt = await resolverSystemPrompt();

  // 6) Llamar a Claude con tool calling
  const resultado = await conversarConHerramientas(
    systemPrompt,
    historialClaude,
    herramientas,
  );

  return resultado;
}

/**
 * Devuelve el system prompt activo del agente admin.
 * Prioridad:
 *   1. cuenta_panel_admin.prompt_sistema (si está seteado y no vacío)
 *   2. SYSTEM_PROMPT_ADMIN_DEFAULT (hardcoded)
 *
 * Si la consulta DB falla, fallback al default — el agente sigue
 * funcionando aunque la DB tenga un hipo.
 */
export async function resolverSystemPrompt(): Promise<string> {
  try {
    const cuenta = await obtenerCuentaPanelAdmin();
    const custom = cuenta?.prompt_sistema?.trim();
    if (custom && custom.length > 0) return custom;
  } catch (err) {
    console.warn("[conversacionAdmin] no se pudo leer prompt custom:", err);
  }
  return SYSTEM_PROMPT_ADMIN_DEFAULT;
}

function mensajeAClaude(m: Mensaje): MensajeClaude {
  return {
    role: m.rol === "usuario" ? "user" : "assistant",
    content: (m.contenido ?? "").slice(0, 4000), // cap defensivo
  };
}
