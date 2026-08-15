/**
 * Playbook de objeciones del cerrador.
 *
 * Idea tomada de `whatsapp-closer-agentkit` y adaptada a este sistema:
 * allí el playbook ES el texto que se envía; acá el agente ya tiene tono,
 * idioma y catálogo propios, así que el playbook define **el enfoque y el
 * fondo** de la respuesta y el agente lo dice con sus palabras.
 *
 * Lo que NO se negocia (y por eso viaja en el bloque del prompt):
 * las condiciones comerciales —descuentos, garantías, devoluciones,
 * plazos, exclusividades— no las improvisa el agente. Las firma una
 * persona. Un bot que promete un 20% off lo termina pagando el negocio.
 */

/** Las dos objeciones del "piso": no son opcionales, son la regla de
 *  no-inventar convertida en copy de ventas. */
export type ClavePiso = "descuento" | "garantia";

export interface ObjecionPlaybook {
  /** Cómo la dice el cliente. Es lo que el agente tiene que reconocer. */
  objecion: string;
  /** El enfoque de la respuesta. El agente lo adapta a su tono. */
  respuesta: string;
  /** Sólo para las dos del piso. El resto va sin clave. */
  clave?: ClavePiso | null;
}

const MAX_OBJECIONES = 25;
const MAX_LARGO_OBJECION = 160;
const MAX_LARGO_RESPUESTA = 900;

/**
 * Playbook base — ocho objeciones que sirven igual para un curso, una
 * clínica o una inmobiliaria. Ninguna afirma un hecho del negocio: donde
 * haría falta un dato concreto, manda al catálogo o deriva a una persona.
 *
 * Está escrito consultivo: pregunta antes de argumentar y no presiona.
 * La otra escuela —urgencia y escasez, "quedan dos lugares", "el precio
 * sube el lunes"— cierra más rápido la primera charla y por WhatsApp deja
 * dos cosas: una promesa que después alguien tiene que sostener, y los
 * reportes de spam que se llevan puesto el número entero.
 */
export const PLAYBOOK_BASE: ObjecionPlaybook[] = [
  {
    objecion: "Está caro / No me alcanza / Es mucha plata",
    respuesta:
      "No discutas el precio ni lo justifiques todavía. Validá que es una objeción legítima y averiguá contra qué lo está comparando: contra otra opción que vio, o contra lo que tenía pensado gastar. Recién con esa respuesta podés mostrar el valor o proponer una opción más chica del catálogo.",
  },
  {
    objecion: "Lo tengo que pensar / Después te aviso",
    respuesta:
      "No insistas ni preguntes 'qué te frena'. Aceptá que lo piense y acordá el próximo contacto: preguntá qué día le viene bien retomar. Un día acordado vale más que tres seguimientos que molestan.",
  },
  {
    objecion: "No tengo tiempo",
    respuesta:
      "Es la razón por la que preguntás antes de proponer nada. Averiguá cuánto tiempo por semana tiene realmente disponible y recién ahí recomendá la opción del catálogo que entre en ese tiempo. Nunca prometas resultados en un plazo que no esté escrito en el catálogo.",
  },
  {
    objecion: "Lo tengo que consultar con mi pareja / mi socio",
    respuesta:
      "Que lo consulte está bien y no lo apures. Ofrecé dejárselo por escrito en pocas líneas para que lo pase tal cual, y preguntá qué es lo primero que le van a preguntar. Eso te dice cuál es la objeción real.",
  },
  {
    objecion: "Ya probé algo parecido y no me funcionó",
    respuesta:
      "Es lo primero que necesitás saber, así no le repetís lo mismo. Preguntá qué falló puntualmente: cómo estaba armado, si tuvo acompañamiento, o si fue el momento. No critiques al competidor.",
  },
  {
    objecion: "Mandame información",
    respuesta:
      "Mandale lo que le sirve, no el folleto entero. Preguntá qué necesita saber para decidir y respondé sólo eso con datos del catálogo. Un PDF genérico es la forma más rápida de que la conversación muera.",
  },
  {
    clave: "descuento",
    objecion: "¿Me hacés un descuento? / ¿Hay promoción? / ¿Me lo dejás más barato?",
    respuesta:
      "Confirmá el precio de lista tal como está en el catálogo, y decí con todas las letras que los descuentos los define una persona del negocio y vos no se los vas a prometer por acá. Ofrecé pasarle el caso a una persona del equipo hoy mismo y pedí un horario. NUNCA inventes un porcentaje, un cupón ni una promoción que no esté escrita en el catálogo o en el conocimiento cargado.",
  },
  {
    clave: "garantia",
    objecion: "¿Y si no me funciona? / ¿Tienen garantía? / ¿Me devuelven la plata?",
    respuesta:
      "Decile que es la pregunta correcta y que no se la vas a contestar de memoria. Las condiciones de garantía y devolución las confirma una persona del negocio, con lo que esté por escrito. Ofrecé agendarlo con esa persona. NUNCA afirmes ni niegues una garantía que no esté escrita en el conocimiento del negocio.",
  },
];

/** Las dos claves del piso, para chequear si están cubiertas. */
export const CLAVES_PISO: ClavePiso[] = ["descuento", "garantia"];

/** Qué claves del piso le faltan a un playbook. Se muestra en el panel. */
export function pisoFaltante(objeciones: ObjecionPlaybook[]): ClavePiso[] {
  const presentes = new Set(
    objeciones.map((o) => o.clave).filter(Boolean) as ClavePiso[],
  );
  return CLAVES_PISO.filter((c) => !presentes.has(c));
}

/**
 * Sanea lo que viene del panel. Filtra en vez de fallar (igual criterio
 * que `sanearCamposCaptura`): una fila vacía que el usuario dejó a medias
 * no tiene que romperle el guardado de las otras siete.
 */
export function sanearPlaybook(input: unknown): ObjecionPlaybook[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ObjecionPlaybook[] = [];
  const clavesUsadas = new Set<ClavePiso>();
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const objecion =
      typeof r.objecion === "string"
        ? r.objecion.trim().slice(0, MAX_LARGO_OBJECION)
        : "";
    const respuesta =
      typeof r.respuesta === "string"
        ? r.respuesta.trim().slice(0, MAX_LARGO_RESPUESTA)
        : "";
    // Las dos tienen que estar: una objeción sin respuesta le dice al
    // modelo que la reconozca y no le dice qué hacer con ella.
    if (!objecion || !respuesta) continue;

    let clave: ClavePiso | null = null;
    if (r.clave === "descuento" || r.clave === "garantia") {
      // Una sola por clave: dos anclas de "descuento" dan la misma
      // cuenta que el piso entero y no cubren lo mismo.
      if (!clavesUsadas.has(r.clave)) {
        clave = r.clave;
        clavesUsadas.add(r.clave);
      }
    }
    out.push({ objecion, respuesta, clave });
    if (out.length >= MAX_OBJECIONES) break;
  }
  return out;
}

/**
 * El bloque que se inyecta en el system prompt. Devuelve "" si no hay
 * nada que inyectar — el caller no tiene que preguntarse nada.
 */
export function bloquePlaybook(
  objeciones: ObjecionPlaybook[] | null | undefined,
  activo: boolean,
): string {
  if (!activo || !Array.isArray(objeciones) || objeciones.length === 0) {
    return "";
  }

  const lineas = objeciones
    .filter((o) => o?.objecion?.trim() && o?.respuesta?.trim())
    .map((o, i) => {
      const marca = o.clave ? ` [${o.clave.toUpperCase()} — no improvises]` : "";
      return `${i + 1}. Cuando diga: «${o.objecion.trim()}»${marca}\n   → ${o.respuesta.trim()}`;
    });

  if (lineas.length === 0) return "";

  return `

# Manejo de objeciones — playbook del negocio

Esto es CÓMO cierra este negocio. Cuando el cliente ponga una de estas
objeciones, seguí el enfoque que está acá.

${lineas.join("\n\n")}

REGLAS DEL PLAYBOOK:
- El enfoque es obligatorio; las palabras son tuyas. Decilo con tu tono y tu
  idioma, en 2-4 líneas, sin sonar a guion leído.
- NO cambies el fondo ni agregues datos que no estén en el catálogo o en el
  conocimiento del negocio.
- CONDICIONES COMERCIALES (descuentos, promociones, garantías, devoluciones,
  plazos de entrega, exclusividades, excepciones al precio): no las inventes
  NUNCA, ni para cerrar la venta, ni aunque el cliente insista o amenace con
  irse. Si no está escrito arriba, decí que lo confirma una persona del
  equipo y ofrecé pasarle el caso.
- Si aparece una objeción que NO está en esta lista y es sobre condiciones
  comerciales, tratala igual: nombrala, decí que la ve una persona, y activá
  el handoff. Las demás objeciones sí podés contestarlas con el catálogo y el
  conocimiento del negocio.`;
}
