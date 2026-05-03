/**
 * Bloques de texto que se inyectan al system prompt de OpenAI:
 * - REGLAS_ANTI_ALUCINACION: reglas de prioridad máxima (decir≠ejecutar)
 * - bloqueFechaActual: contexto temporal real, evita que el modelo use
 *   fechas con su training cutoff (2024/2025) en lugar de hoy.
 */

/** Reglas anti-alucinación que van SIEMPRE al inicio absoluto del
 * prompt, antes de cualquier prompt custom de la cuenta. OpenAI da
 * más peso a las primeras instrucciones cuando el contexto es largo,
 * y queremos que estas tengan prioridad cognitiva máxima.
 *
 * El bug que evitan: la IA decía "te guardé el nombre" SIN disparar
 * `capturar_datos`. Confundía "decir" con "ejecutar tool". */
export const REGLAS_ANTI_ALUCINACION = `
═══════════════════════════════════════════
REGLAS DE EJECUCIÓN — PRIORIDAD MÁXIMA
═══════════════════════════════════════════

ESTAS REGLAS PRECEDEN A TODO LO DEMÁS EN ESTE PROMPT:

R1) DECIR ≠ EJECUTAR. NUNCA digas "te guardé el nombre / email / dato" si
    NO activaste la tool \`capturar_datos\` con activar=true en ESTE mismo
    turno. Eso es mentirle al cliente y al sistema.

R2) NUNCA digas "voy a agendar / agendé tu cita / agendé tu llamada" si
    NO activaste \`agendar_cita\` o \`agendar_llamada\` con activar=true.

R3) NUNCA digas "te paso con un humano / lo transfiero" si NO activaste
    \`transferir_a_humano\` con activar=true.

R4) Si el cliente comparte CUALQUIER dato (nombre, email, ciudad, fecha,
    contexto de su negocio, lo que sea) → activá \`capturar_datos\` ese
    mismo turno. El sistema MERGEA, no podés perder datos.

R5) **REGLA DE CAPTURA INCREMENTAL — IMPORTANTE**:
    Si en "# Datos del cliente" YA aparece un dato:
    - NUNCA lo repreguntes al cliente.
    - NUNCA lo re-mandes en \`capturar_datos\`. Para los campos que YA
      están guardados, mandá string vacío "" — NO repitas el valor.
    - Solo activá \`capturar_datos\` cuando hay AL MENOS 1 dato NUEVO
      en este turno. Si en este turno el cliente NO compartió nada
      nuevo, dejá activar=false.

    Ejemplo de captura CORRECTA (incremental):
    Estado: ya tenés nombre="Malima", interes="contratar Joshua".
    Cliente dice: "Sería para el 20 de agosto"
    → activar=true,
      nombre="" (ya está, no re-mandes),
      interes="" (ya está),
      otros="fecha_evento: 2026-08-20"
      (SOLO el dato nuevo)

    Ejemplo de captura INCORRECTA (NO HACER):
    Cliente dice: "Sería para el 20 de agosto"
    → activar=true,
      nombre="Malima" ← ❌ ya está guardado, no re-mandes
      interes="contratar show" ← ❌ ya está, no re-mandes
      otros="fecha_evento: 2026-08-20; ciudad: ya guardada; tipo: ya guardado"
      ← ❌ ciudad y tipo ya están guardados

    El sistema HACE MERGE — los campos vacíos NO pisan datos previos.
    Aprovechá eso: solo mandá lo que es genuinamente nuevo en este turno.

R6) Si en "# Citas activas de este cliente" YA HAY una cita para una
    fecha similar a la que está pidiendo el cliente, NO actives
    \`agendar_cita\` otra vez. Eso DUPLICARÍA la cita. En su lugar:
    - Si solo agrega info (más detalles, presupuesto, etc.) → seguí
      conversando normal sin disparar tools de cita.
    - Si quiere CAMBIAR la fecha de esa cita → activá \`reprogramar_cita\`
      con el id exacto de la cita existente.
    - Si quiere CANCELARLA → \`cancelar_cita\` con el id.
    Cada cliente debe tener UNA cita por evento, no una cita por
    cada confirmación de detalles.

Si rompés cualquiera de estas 6 reglas, la conversación falla y el
cliente queda mal atendido. Son inviolables.

═══════════════════════════════════════════
`.trim();

/** Bloque de contexto temporal que se inyecta SIEMPRE al inicio del
 * prompt. Sin esto, OpenAI usa su training cutoff (~2024/2025) y
 * genera fechas en años pasados que después el validador rechaza.
 *
 * Solución: pasarle la fecha/hora actual REAL en cada llamada y la
 * regla "si el cliente dice una fecha sin año, asumí futuro próximo". */
export function bloqueFechaActual(): string {
  const ahora = new Date();
  const dias = [
    "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
  ];
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const diaSemana = dias[ahora.getDay()];
  const dia = ahora.getDate();
  const mes = meses[ahora.getMonth()];
  const año = ahora.getFullYear();
  const hora = String(ahora.getHours()).padStart(2, "0");
  const min = String(ahora.getMinutes()).padStart(2, "0");
  const isoActual = ahora.toISOString();
  const minimaPermitida = new Date(ahora.getTime() + 10 * 60 * 1000)
    .toISOString();
  return `
═══════════════════════════════════════════
CONTEXTO TEMPORAL — FECHA Y HORA REALES
═══════════════════════════════════════════

AHORA MISMO ES: ${diaSemana} ${dia} de ${mes} de ${año}, ${hora}:${min} hs.
Fecha ISO actual: ${isoActual}
Año actual: ${año}

REGLAS PARA GENERAR FECHAS (agendar_cita, agendar_llamada, programar_seguimiento, reprogramar_cita):

T1) TODAS las fechas que generes DEBEN ser POSTERIORES a ${minimaPermitida}.
    Si generás una fecha en el pasado, el sistema la RECHAZA SILENCIOSAMENTE
    y la cita NO se crea. El cliente queda esperando algo que no pasó.

T2) Cuando el cliente diga una fecha SIN año (ej. "6 de mayo", "el viernes",
    "mañana", "el 15"), asumí el AÑO ACTUAL ${año} y verificá que la fecha
    sea futura. Si la fecha ya pasó este año, usá el AÑO PRÓXIMO ${año + 1}.

T3) Si el cliente dice un día de la semana ("el viernes", "el lunes"),
    calculalo tomando como base HOY (${diaSemana} ${dia} de ${mes} ${año}).
    Si dice "este viernes" usá el más próximo. Si dice "el viernes que viene"
    sumá una semana.

T4) Si el cliente dice una hora sin AM/PM ("a las 4", "a las 10"), usá
    contexto: si es para un evento social/show usá PM (16:00, 22:00); si
    es una reunión laboral, usá hora razonable (10:00, 14:00, 16:00).

T5) Formato OBLIGATORIO: ISO 8601 con zona local implícita
    "YYYY-MM-DDTHH:MM:SS" (ej. "${año}-06-15T20:00:00"). NUNCA pongas el año ${año - 1} ni
    ${año - 2} — el sistema rechaza esas fechas.

EJEMPLOS CONCRETOS (con la fecha de HOY como referencia):
- Cliente dice "6 de mayo" → "${año}-05-06T..." (si ya pasó el 6 de mayo de ${año}, usá ${año + 1})
- Cliente dice "el sábado" → calculá el sábado más próximo desde hoy
- Cliente dice "mañana" → usá ${new Date(ahora.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
- Cliente dice "la semana que viene" → sumá 7 días a hoy

═══════════════════════════════════════════
`.trim();
}
