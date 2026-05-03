import type {
  Cita,
  Conversacion,
  Cuenta,
  EntradaConocimiento,
  MedioBiblioteca,
  Producto,
} from "./baseDatos";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";

/**
 * Combina los niveles de configuración del agente en un único system prompt:
 *
 * 1) Instrucciones base (tono, reglas, personaje): cuenta.prompt_sistema
 * 2) Texto libre del negocio: cuenta.contexto_negocio
 * 3) Entradas estructuradas (productos, FAQs, etc): conocimiento[]
 * 4) Biblioteca de medios disponibles que el agente puede enviar
 * 5) Catálogo de productos con precio y stock
 * 6) (opcional) Datos del cliente capturados + lead state + citas activas
 *    de la conversación actual. Se incluye si se pasa `conversacion`.
 */
/** Reglas anti-alucinación que van SIEMPRE al inicio absoluto del
 * prompt, antes de cualquier prompt custom de la cuenta. OpenAI da
 * más peso a las primeras instrucciones cuando el contexto es largo,
 * y queremos que estas tengan prioridad cognitiva máxima.
 *
 * El bug que evitan: la IA decía "te guardé el nombre" SIN disparar
 * `capturar_datos`. Confundía "decir" con "ejecutar tool". */
const REGLAS_ANTI_ALUCINACION = `
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
function bloqueFechaActual(): string {
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

export function construirPromptSistema(
  cuenta: Cuenta,
  conocimiento: EntradaConocimiento[],
  biblioteca: MedioBiblioteca[] = [],
  productos: Producto[] = [],
  conversacion?: Conversacion | null,
  citasActivas: Cita[] = [],
): string {
  const partes: string[] = [];

  // Contexto temporal SIEMPRE primero — sin esto la IA inventa fechas
  // del pasado (training cutoff) y el validador las rechaza.
  partes.push(bloqueFechaActual());

  // Reglas anti-alucinación segundo, antes del prompt custom.
  partes.push("\n\n" + REGLAS_ANTI_ALUCINACION);

  // ============================================================
  // IDENTIDAD del agente (Tab General de /configuracion).
  // GANA SOBRE TODO. Si el prompt_sistema custom dice otra cosa,
  // la identidad de acá la sobrescribe — porque la inyectamos al
  // inicio (primacy effect) Y al final (recency effect) del prompt.
  // ============================================================
  const tonoMap: Record<string, string> = {
    formal: "formal y respetuoso",
    casual_amigable: "casual, amigable y cercano",
    profesional: "profesional, directo y consultivo",
    cercano: "cálido, cercano, como hablás con un amigo",
    directo: "directo, eficiente, al grano",
    consultivo: "consultivo, escucha primero, ofrece después",
  };
  const idiomaMap: Record<string, string> = {
    es: "español neutro",
    "es-AR": "español rioplatense (Argentina)",
    "es-CO": "español colombiano",
    "es-MX": "español mexicano",
    en: "English",
    pt: "português",
  };
  const nombreAgente = cuenta.agente_nombre?.trim();
  const rolAgente = cuenta.agente_rol?.trim();
  const personalidad = cuenta.agente_personalidad?.trim();
  const idioma = cuenta.agente_idioma;
  const tono = cuenta.agente_tono;

  // Construimos el bloque siempre que haya un nombre del agente. El rol
  // puede ser "asistente virtual" (default) y eso ESTÁ BIEN — la IA
  // necesita saber el nombre para presentarse correctamente.
  const tieneIdentidadCustom = !!(nombreAgente && nombreAgente.trim());

  if (tieneIdentidadCustom) {
    const lineas: string[] = [];
    if (nombreAgente) {
      lineas.push(
        `🆔 TU NOMBRE ES: **${nombreAgente}** (NO sos "asistente virtual" ni ningún otro nombre — sos ${nombreAgente})`,
      );
    }
    if (rolAgente) {
      lineas.push(`🎭 TU ROL: ${rolAgente}`);
    }
    if (personalidad) lineas.push(`💬 Personalidad: ${personalidad}`);
    if (tono) {
      lineas.push(`🎵 Tono: ${tonoMap[tono] ?? tono}`);
    }
    if (idioma) {
      lineas.push(
        `🌍 Idioma: respondé SIEMPRE en ${idiomaMap[idioma] ?? idioma}`,
      );
    }
    const reglasNombre = nombreAgente
      ? `

REGLAS DE IDENTIDAD — INVIOLABLES:
- Cuando el cliente pregunte "cómo te llamás", "cuál es tu nombre", "quién sos",
  respondé con tu nombre: **${nombreAgente}**.
- NUNCA digas que sos "el asistente virtual", "el bot", o cualquier nombre
  genérico. Sos ${nombreAgente}.
- Si en otras secciones del prompt aparece otro nombre (un personaje, una
  empresa, etc.), eso es CONTEXTO del negocio donde trabajás, NO sos vos.
  Vos sos ${nombreAgente} trabajando para ese negocio.
- Si firmás mensajes, firmás como ${nombreAgente}.`
      : "";

    partes.push(
      "\n\n═══════════════════════════════════════════\n" +
        "IDENTIDAD DEL AGENTE — PRIORIDAD MÁXIMA\n" +
        "═══════════════════════════════════════════\n\n" +
        lineas.join("\n") +
        reglasNombre,
    );
  }

  // Mensaje "no entiende" — fallback configurable por el dueño
  const mensajeNoEntiende = cuenta.mensaje_no_entiende?.trim();
  if (mensajeNoEntiende) {
    partes.push(
      `\n\nSI no entendés lo que el cliente quiere, respondé exactamente: "${mensajeNoEntiende}"`,
    );
  }

  // Instrucciones extra (texto libre del dueño)
  const extra = cuenta.instrucciones_extra?.trim();
  if (extra) {
    partes.push(`\n\n# Instrucciones personalizadas del negocio\n\n${extra}`);
  }

  const promptBase = cuenta.prompt_sistema?.trim();
  partes.push("\n\n" + (promptBase || PROMPT_SISTEMA_DEFAULT));

  const contexto = cuenta.contexto_negocio?.trim();
  if (contexto) {
    partes.push("\n\n# Información del negocio\n\n" + contexto);
  }

  // Solo inyectamos al prompt entradas ACTIVAS con título y contenido.
  // El dueño puede desactivar una entrada (esta_activo=false) sin
  // borrarla, para excluirla del agente sin perder el contenido.
  const entradasValidas = conocimiento.filter(
    (e) => e.esta_activo !== false && e.titulo.trim() && e.contenido.trim(),
  );
  if (entradasValidas.length > 0) {
    partes.push("\n\n# Información clave de referencia\n");
    // Agrupamos por categoría para que el prompt sea más legible
    const porCat = new Map<string, EntradaConocimiento[]>();
    for (const e of entradasValidas) {
      const cat = e.categoria?.trim() || "general";
      if (!porCat.has(cat)) porCat.set(cat, []);
      porCat.get(cat)!.push(e);
    }
    for (const [cat, items] of porCat) {
      if (porCat.size > 1) partes.push(`\n### Categoría: ${cat}\n`);
      for (const e of items) {
        partes.push(`\n## ${e.titulo.trim()}\n\n${e.contenido.trim()}\n`);
      }
    }
  }

  if (biblioteca.length > 0) {
    partes.push(
      "\n\n# Medios disponibles para enviar\n\n" +
        "Tenés estos archivos pre-cargados que podés enviar al cliente cuando " +
        "convenga. Para enviarlos, agregá una parte con tipo='media' y media_id " +
        "exactamente igual al identificador. NO inventes identificadores.\n",
    );
    for (const m of biblioteca) {
      partes.push(
        `\n- **${m.identificador}** (${m.tipo}): ${m.descripcion.trim() || "(sin descripción)"}`,
      );
    }
    partes.push("\n");
  }

  const productosActivos = productos.filter((p) => p.esta_activo);
  if (productosActivos.length > 0) {
    partes.push(
      "\n\n# Catálogo de productos\n\n" +
        "Estos son los productos que vende el negocio. Cuando el cliente " +
        "pregunte por algo, usá esta info para responder con precio, " +
        "stock y descripción reales. SI un cliente pregunta o muestra " +
        "interés en alguno (precio, info, fotos, comprar), incluí su ID " +
        "en el campo `productos_de_interes` de tu respuesta JSON. " +
        "Si está SIN stock decílo claramente y ofrecé alternativas.\n",
    );
    const porCategoria = new Map<string, Producto[]>();
    for (const p of productosActivos) {
      const cat = p.categoria?.trim() || "General";
      if (!porCategoria.has(cat)) porCategoria.set(cat, []);
      porCategoria.get(cat)!.push(p);
    }
    for (const [cat, items] of porCategoria) {
      partes.push(`\n## ${cat}\n`);
      for (const p of items) {
        const linea: string[] = [`- **${p.nombre}** (id: ${p.id})`];
        if (p.precio != null) {
          linea.push(`precio: ${p.precio} ${p.moneda}`);
        } else {
          linea.push("precio: a consultar");
        }
        if (p.stock != null) {
          linea.push(p.stock > 0 ? `stock: ${p.stock}` : "SIN STOCK");
        }
        if (p.sku) linea.push(`SKU: ${p.sku}`);
        partes.push(linea.join(" — "));
        if (p.descripcion?.trim()) {
          partes.push(`  · ${p.descripcion.trim().slice(0, 200)}`);
        }
      }
    }
    partes.push("\n");
  }

  // ============================================================
  // Contexto del cliente actual: lead state + datos capturados +
  // citas activas. Es la sección que la IA usa para llamar al
  // cliente por su nombre real, no repreguntar lo que ya tiene,
  // y modificar/cancelar citas existentes.
  // ============================================================
  if (conversacion) {
    const dc = conversacion.datos_capturados ?? {};
    const lineas: string[] = [];

    // Nombre real (capturado por IA) > nombre de WhatsApp.
    const nombreReal = dc.nombre?.trim();
    const nombreWa = conversacion.nombre?.trim();
    if (nombreReal) {
      lineas.push(`- Nombre real capturado: ${nombreReal} (USAR ÉSTE para dirigirte al cliente)`);
      if (nombreWa && nombreWa !== nombreReal) {
        lineas.push(`- Nombre en WhatsApp: ${nombreWa} (NO usar — puede ser ficticio)`);
      }
    } else {
      lineas.push(
        `- Nombre real: NO CAPTURADO TODAVÍA. ${
          nombreWa
            ? `WhatsApp dice "${nombreWa}" pero puede ser ficticio. PEDÍ el nombre real en este mismo turno o el próximo (NO esperés).`
            : "PEDÍ el nombre real en este mismo turno (es la primera pregunta natural en cualquier conversación)."
        } Cuando lo digan, activá \`capturar_datos\` con nombre=valor.`,
      );
    }
    lineas.push(`- Teléfono WhatsApp: +${conversacion.telefono}`);
    if (dc.email) lineas.push(`- Email: ${dc.email}`);
    if (dc.telefono_alt) lineas.push(`- Teléfono alternativo: ${dc.telefono_alt}`);
    if (dc.interes) lineas.push(`- Interés/necesidad: ${dc.interes}`);
    if (dc.negocio) lineas.push(`- Negocio/contexto: ${dc.negocio}`);
    if (dc.ventajas) lineas.push(`- Ventajas que valora: ${dc.ventajas}`);
    if (dc.miedos) lineas.push(`- Miedos/objeciones: ${dc.miedos}`);
    if (dc.otros && Object.keys(dc.otros).length > 0) {
      const otrosStr = Object.entries(dc.otros)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      lineas.push(`- Otros datos: ${otrosStr}`);
    }

    lineas.push(
      `- Lead score actual: ${conversacion.lead_score}/100 (subilo/bajalo con \`actualizar_score\` cuando cambie >= 10 puntos)`,
    );
    lineas.push(
      `- Estado del lead: ${conversacion.estado_lead} (cambialo con \`cambiar_estado\` en transiciones reales)`,
    );

    partes.push("\n\n# Datos del cliente (CRM)\n\n" + lineas.join("\n") + "\n");
  }

  // ============================================================
  // Campos personalizados que el dueño quiere que capturemos.
  // Cada campo trae:
  //   - clave + descripción (qué es)
  //   - pregunta_sugerida (CÓMO pedirlo, definida por el dueño)
  //   - obligatorio (si ⚠️ debe pedirse antes de cerrar)
  //   - orden (1, 2, 3... orden preferido de captura)
  //
  // Si ya está capturado en datos_capturados.otros, marca con ✅ y la
  // IA NO repregunta. El próximo campo no capturado se marca como
  // "PRÓXIMA PREGUNTA SUGERIDA" para guiar a la IA.
  // ============================================================
  const camposCustom = [...(cuenta.campos_a_capturar ?? [])].sort(
    (a, b) => (a.orden ?? 100) - (b.orden ?? 100),
  );
  if (camposCustom.length > 0) {
    const otrosCapturados = conversacion?.datos_capturados?.otros ?? {};
    const lineas: string[] = [];
    let proximaSugerida: { campo: typeof camposCustom[0] } | null = null;
    for (const campo of camposCustom) {
      const valor = otrosCapturados[campo.clave]?.trim();
      const marca = valor ? "✅" : campo.obligatorio ? "⚠️" : "•";
      const desc = campo.descripcion?.trim() || "(sin descripción)";
      const oblig = campo.obligatorio ? " [OBLIGATORIO]" : "";
      const preg = campo.pregunta_sugerida?.trim();
      const sugLine = preg ? `\n     Pregunta sugerida: "${preg}"` : "";
      const yaCapt = valor ? ` — ✅ YA CAPTURADO: "${valor}" (NO repreguntes)` : "";
      lineas.push(`${marca} ${campo.clave}: ${desc}${oblig}${sugLine}${yaCapt}`);
      // El primero NO capturado (priorizando obligatorios) es la próxima
      // pregunta sugerida para la IA.
      if (!valor && !proximaSugerida && (campo.obligatorio || true)) {
        proximaSugerida = { campo };
      }
    }
    let sugerenciaSiguiente = "";
    if (proximaSugerida) {
      const c = proximaSugerida.campo;
      const preg = c.pregunta_sugerida?.trim();
      sugerenciaSiguiente = preg
        ? `\n\nPRÓXIMA PREGUNTA SUGERIDA (cuando sea natural): "${preg}"`
        : `\n\nPRÓXIMA INFO A CAPTURAR (cuando sea natural): ${c.descripcion}`;
    }
    partes.push(
      "\n\n# Datos personalizados a capturar (configurados por el negocio)\n\n" +
        "Además de los datos core (nombre, email, teléfono, interés, negocio, ventajas, miedos), " +
        "este negocio quiere que captures estos campos extra. " +
        "Cuando captures alguno, llamá a `capturar_datos` y poné en el campo `otros` el formato " +
        "`clave: valor; otra_clave: otro_valor`. " +
        "Los marcados con ⚠️ son OBLIGATORIOS antes de cerrar la conversación. " +
        "Los ✅ ya están capturados — NO repreguntes.\n\n" +
        "Si un campo tiene `Pregunta sugerida`, USÁ esa pregunta o una variación natural " +
        "de tu propio estilo. NO copies textual si rompe la fluidez de la conversación.\n\n" +
        lineas.join("\n") +
        sugerenciaSiguiente +
        "\n",
    );
  }

  if (citasActivas.length > 0) {
    partes.push(
      "\n\n# Citas activas de este cliente\n\n" +
        "Estas son las citas YA AGENDADAS de este cliente. Si pide " +
        "reprogramar o cancelar, usá el id EXACTO de abajo en " +
        "`reprogramar_cita.cita_id` o `cancelar_cita.cita_id`. " +
        "NO inventes ids.\n",
    );
    for (const c of citasActivas) {
      const fechaStr = new Date(c.fecha_hora).toLocaleString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const linea = [
        `- id=${c.id}`,
        c.tipo ? `tipo: ${c.tipo}` : "",
        `fecha: ${fechaStr}`,
        `duración: ${c.duracion_min} min`,
        `estado: ${c.estado}`,
      ]
        .filter(Boolean)
        .join(" — ");
      partes.push(linea);
      if (c.notas?.trim()) {
        partes.push(`  · notas: ${c.notas.trim().slice(0, 160)}`);
      }
    }
    partes.push("\n");
  }

  // ============================================================
  // RECORDATORIO FINAL — recency effect.
  // Si hay nombre del agente configurado, lo repetimos al final
  // del prompt. Las instrucciones más cercanas al final tienen
  // más peso para la IA.
  // ============================================================
  if (tieneIdentidadCustom && nombreAgente) {
    partes.push(
      `\n\n═══════════════════════════════════════════\n` +
        `RECORDATORIO FINAL — TU NOMBRE\n` +
        `═══════════════════════════════════════════\n\n` +
        `Tu nombre es **${nombreAgente}**. ` +
        `Cuando alguien pregunte cómo te llamás, decí "${nombreAgente}". ` +
        `NO uses nombres genéricos como "asistente" ni nombres que aparezcan ` +
        `en el contexto del negocio (esos son del cliente o del producto, no tuyos).\n`,
    );
  }

  return partes.join("");
}
