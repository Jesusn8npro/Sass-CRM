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
import { REGLAS_ANTI_ALUCINACION, bloqueFechaActual } from "./construirPrompt-bloques";
import type { ResultadoBusquedaChunk } from "./baseDatos";


export function construirPromptSistema(
  cuenta: Cuenta,
  conocimiento: EntradaConocimiento[],
  biblioteca: MedioBiblioteca[] = [],
  productos: Producto[] = [],
  conversacion?: Conversacion | null,
  citasActivas: Cita[] = [],
  /** Si se pasan chunks via RAG, los usamos en vez del dump completo
   *  de conocimiento. Si llega array vacío o undefined, fallback a dump. */
  chunksRAG?: ResultadoBusquedaChunk[],
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

  // Estilo de respuesta del agente — controla cómo mezcla texto/audio/media.
  // Se inyecta como bloque de prioridad alta para que la IA lo respete por
  // sobre las instrucciones genéricas del schema.
  const tieneVoz =
    !!cuenta.voz_elevenlabs && cuenta.voz_elevenlabs.trim().length > 0;
  const tieneApiKeyEleven = !!process.env.ELEVENLABS_API_KEY;
  const puedeUsarVoz = tieneVoz && tieneApiKeyEleven;
  const tieneBiblioteca = biblioteca.length > 0;

  let bloqueModo = "";
  switch (cuenta.modo_respuesta ?? "mixto") {
    case "solo_texto":
      bloqueModo = `
ESTILO DE RESPUESTA — SOLO TEXTO:
- Toda respuesta debe ser tipo="texto". NUNCA uses tipo="audio" ni tipo="media".
- Aunque el cliente mande audio, vos respondés solo con texto.
- Mantené las partes cortas y naturales (1-3 líneas cada una).`;
      break;
    case "solo_audio":
      if (puedeUsarVoz) {
        bloqueModo = `
ESTILO DE RESPUESTA — SOLO AUDIO:
- Respondé SIEMPRE con al menos una parte tipo="audio". El "contenido" del audio se sintetiza con voz.
- Los datos exactos (precios, links, mails, números) van en parte tipo="texto" aparte
  para que el cliente los pueda copiar.
- Para mostrar algo visual (productos, comprobantes), usá tipo="media" + media_id.`;
      } else {
        // Fallback si la cuenta pidió "solo_audio" pero falta config
        bloqueModo = `
ESTILO DE RESPUESTA — TEXTO (audio no disponible):
- La cuenta pidió "solo_audio" pero falta voz_elevenlabs o ELEVENLABS_API_KEY.
- Respondé en texto hasta que se configure la voz.`;
      }
      break;
    case "espejo_voz":
      if (puedeUsarVoz) {
        bloqueModo = `
ESTILO DE RESPUESTA — ESPEJO DE VOZ:
- Si el cliente te mandó AUDIO (lo verás como "[mensaje de audio del cliente]"),
  respondé con al menos UNA parte tipo="audio".
- Si el cliente escribió TEXTO, respondé solo con tipo="texto".
- Datos exactos siempre en tipo="texto" para copiar.`;
      } else {
        bloqueModo = `
ESTILO DE RESPUESTA — TEXTO (audio no disponible):
- La cuenta pidió "espejo_voz" pero falta voz_elevenlabs o ELEVENLABS_API_KEY.
- Respondé en texto hasta que se configure la voz.`;
      }
      break;
    default: {
      // mixto
      const partesAudio = puedeUsarVoz
        ? "- Si el cliente te manda audio, respondé con al menos una parte tipo=\"audio\".\n  Para responder largo o cálido a veces usá audio aunque el cliente haya escrito.\n"
        : "- (Audio NO disponible — falta voz_elevenlabs o ELEVENLABS_API_KEY.)\n";
      const partesMedia = tieneBiblioteca
        ? "- Cuando convenga mostrar algo visual (producto, catálogo, comprobante)\n  agregá una parte tipo=\"media\" con un media_id de la biblioteca.\n"
        : "";
      bloqueModo = `
ESTILO DE RESPUESTA — MIXTO (variado y natural):
- La mayoría de las respuestas son tipo="texto" porque WhatsApp es principalmente texto.
${partesAudio}${partesMedia}- Datos exactos (precios, links, mails, números) SIEMPRE en tipo="texto" para copiar.
- Mezclá libremente: texto+texto, texto+audio, audio+texto+media, etc.
- Máximo 1-2 audios y 1-2 medios por respuesta — no satures.`;
    }
  }
  partes.push("\n\n" + bloqueModo.trim());

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

  // Modo RAG: si vinieron chunks pre-buscados por similitud semántica,
  // los usamos en vez del dump completo. Es lo más eficiente.
  if (chunksRAG && chunksRAG.length > 0) {
    partes.push("\n\n# Información clave de referencia (relevante a la consulta)\n");
    for (const c of chunksRAG) {
      partes.push(
        `\n## ${c.titulo} ${c.categoria !== "general" ? `· ${c.categoria}` : ""}\n\n${c.contenido}\n`,
      );
    }
  } else {
    // Modo dump (fallback): la cuenta no tiene RAG indexado todavia,
    // o la búsqueda devolvió cero matches. Inyectamos todo el
    // conocimiento activo agrupado por categoría.
    const entradasValidas = conocimiento.filter(
      (e) => e.esta_activo !== false && e.titulo.trim() && e.contenido.trim(),
    );
    if (entradasValidas.length > 0) {
      partes.push("\n\n# Información clave de referencia\n");
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
