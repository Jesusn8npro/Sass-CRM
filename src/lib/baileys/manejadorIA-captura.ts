/**
 * Captura de datos del cliente (CRM) — captura_datos / actualizar_score
 * / cambiar_estado de la respuesta IA + fallback heurístico (regex).
 *
 * Garantiza que NUNCA se pierda un dato evidente del cliente: si la IA
 * no disparó capturar_datos pero el último mensaje tiene nombre/email/
 * ciudad/fecha/cantidad, los detectamos y guardamos igual.
 */
import {
  actualizarLead,
  insertarMensaje,
  type Conversacion,
  type Cuenta,
  type EstadoLead,
  type Mensaje,
} from "../baseDatos";
import { type RespuestaIA } from "../openai";
import { dispararWebhook } from "../webhooks";

export async function procesarCapturaIA(
  respuesta: RespuestaIA,
  historial: Mensaje[],
  cuenta: Cuenta,
  conversacion: Conversacion,
  prefijo: string,
): Promise<void> {
  // Acumulamos los cambios para hacer 1 sola UPDATE + 1 mensaje sistema
  // visible que resume todo lo capturado en este turno.
  const cambiosLead: Parameters<typeof actualizarLead>[1] = {};
  const partesMensajeSistemaCRM: string[] = [];

  // FALLBACK HEURÍSTICO — si la IA no disparó capturar_datos pero el
  // último mensaje del cliente tiene datos detectables (nombre con
  // patrón "soy X" / "me llamo X", email, teléfono), capturamos igual.
  // Defensivo: garantiza que NUNCA perdamos un dato evidente.
  const ultimoUsuario = [...historial]
    .reverse()
    .find((m) => m.rol === "usuario");
  const textoCliente = ultimoUsuario?.contenido?.trim() ?? "";
  const datosYaCapturados = conversacion.datos_capturados ?? {};

  // Patrón nombre: "soy X", "me llamo X", "soy X de Y", "yo soy X"
  // Capturamos hasta 4 palabras (nombre + apellidos) — corte natural en
  // verbos comunes ("y necesito", "tengo", "vivo en", etc).
  if (!datosYaCapturados.nombre?.trim() && !respuesta.capturar_datos?.nombre?.trim()) {
    const reNombre =
      /(?:soy|me llamo|mi nombre es|aqu[ií] (?:est[áa]|habla))\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/iu;
    const m = textoCliente.match(reNombre);
    if (m && m[1]) {
      const nombreDetectado = m[1].trim();
      cambiosLead.datos_capturados_merge = {
        ...(cambiosLead.datos_capturados_merge ?? {}),
        nombre: nombreDetectado,
      };
      cambiosLead.nombre = nombreDetectado;
      partesMensajeSistemaCRM.push(`✓ Nombre detectado: ${nombreDetectado}`);
      console.log(
        `${prefijo} 🔍 fallback heurístico: nombre="${nombreDetectado}" (la IA no lo capturó)`,
      );
    }
  }

  // Email — regex simple, ya tenemos `extraerEmailsDelTexto` pero lo
  // hacemos inline para no duplicar trabajo.
  if (!datosYaCapturados.email?.trim() && !respuesta.capturar_datos?.email?.trim()) {
    const reEmail = /[\w.+-]+@[\w-]+\.[\w.-]+/;
    const m = textoCliente.match(reEmail);
    if (m && m[0]) {
      const emailDetectado = m[0].toLowerCase();
      cambiosLead.datos_capturados_merge = {
        ...(cambiosLead.datos_capturados_merge ?? {}),
        email: emailDetectado,
      };
      partesMensajeSistemaCRM.push(`✓ Email detectado: ${emailDetectado}`);
      console.log(
        `${prefijo} 🔍 fallback heurístico: email="${emailDetectado}" (la IA no lo capturó)`,
      );
    }
  }

  // ============================================================
  // FALLBACK extendido: detectar campos custom (ciudad, fecha,
  // cantidad invitados, tipo evento) en el historial reciente —
  // no solo el último mensaje. Cubre el caso típico donde la IA
  // entiende los datos pero no los persiste con la tool.
  // ============================================================
  const otrosYaCapturados = datosYaCapturados.otros ?? {};
  // Concatenamos los últimos 6 mensajes del usuario para pescar datos
  // que pueden venir spread en varios turnos ("100 personas", "5 de
  // mayo", "Manizales").
  const textoHistorial = historial
    .filter((m) => m.rol === "usuario")
    .slice(-6)
    .map((m) => m.contenido ?? "")
    .join(" \n ");
  const otrosDetectados: Record<string, string> = {};

  // Ciudad — lista corta de ciudades grandes de Colombia + patrón "en X"
  // donde X arranca con mayúscula. Conservador para no capturar nombres.
  if (!otrosYaCapturados.ciudad?.trim()) {
    const ciudadesComunes = [
      "Bogotá","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga",
      "Pereira","Manizales","Santa Marta","Cúcuta","Ibagué","Villavicencio",
      "Pasto","Neiva","Armenia","Popayán","Sincelejo","Valledupar",
      "Montería","Tunja","Riohacha","Quibdó","Florencia","Yopal",
      "Bogota","Medellin","Cucuta","Ibague","Popayan","Monteria",
    ];
    const re = new RegExp(`\\b(${ciudadesComunes.join("|")})\\b`, "i");
    const m = textoHistorial.match(re);
    if (m && m[1]) {
      const ciudadNorm = m[1]
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      // Re-canonizar a forma con tildes
      const map: Record<string, string> = {
        bogota: "Bogotá", medellin: "Medellín", cucuta: "Cúcuta",
        ibague: "Ibagué", popayan: "Popayán", monteria: "Montería",
      };
      const ciudadDetectada = map[ciudadNorm] ?? m[1];
      otrosDetectados.ciudad = ciudadDetectada;
      console.log(
        `${prefijo} 🔍 fallback heurístico: ciudad="${ciudadDetectada}" (la IA no lo capturó)`,
      );
    }
  }

  // Cantidad de invitados — "X personas" / "X invitados" / "para X"
  if (!otrosYaCapturados.cantidad_invitados?.trim() && !otrosYaCapturados.tamano_equipo?.trim()) {
    const reCant = /\b(\d{2,4})\s*(?:personas|invitados|asistentes|gentes?)\b/i;
    const m = textoHistorial.match(reCant);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n >= 5 && n <= 5000) {
        otrosDetectados.cantidad_invitados = String(n);
        console.log(
          `${prefijo} 🔍 fallback heurístico: cantidad_invitados=${n}`,
        );
      }
    }
  }

  // Fecha del evento — "5 de mayo", "el 15 de marzo de 2026", "viernes 6"
  if (
    !otrosYaCapturados.fecha_evento?.trim() &&
    !otrosYaCapturados.fecha_inicio?.trim()
  ) {
    const meses =
      "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";
    const reFecha = new RegExp(
      `\\b(\\d{1,2})\\s*(?:de\\s+)?(${meses})(?:\\s+(?:de\\s+)?(\\d{4}))?`,
      "i",
    );
    const m = textoHistorial.match(reFecha);
    if (m && m[1] && m[2]) {
      const fechaStr = `${m[1]} de ${m[2].toLowerCase()}${m[3] ? ` de ${m[3]}` : ""}`;
      otrosDetectados.fecha_evento = fechaStr;
      console.log(
        `${prefijo} 🔍 fallback heurístico: fecha_evento="${fechaStr}"`,
      );
    }
  }

  // Tipo de evento — palabras clave comunes
  if (!otrosYaCapturados.tipo_evento?.trim()) {
    const tipos = [
      ["boda", "boda"],
      ["matrimonio", "boda"],
      ["fiesta patronal", "fiesta patronal"],
      ["fiesta", "fiesta privada"],
      ["cumpleaños", "cumpleaños"],
      ["quince", "quinceaños"],
      ["quinceañera", "quinceaños"],
      ["corporativo", "evento corporativo"],
      ["empresarial", "evento corporativo"],
      ["serenata", "serenata"],
      ["show", "show en vivo"],
      ["concierto", "concierto"],
      ["grabación", "sesión de estudio"],
      ["estudio", "sesión de estudio"],
    ] as const;
    const tlow = textoHistorial.toLowerCase();
    for (const [palabra, normalizado] of tipos) {
      if (tlow.includes(palabra)) {
        otrosDetectados.tipo_evento = normalizado;
        console.log(
          `${prefijo} 🔍 fallback heurístico: tipo_evento="${normalizado}"`,
        );
        break;
      }
    }
  }

  // Si detectamos algo en otros, lo aplicamos al merge
  if (Object.keys(otrosDetectados).length > 0) {
    cambiosLead.datos_capturados_merge = {
      ...(cambiosLead.datos_capturados_merge ?? {}),
      otros: {
        ...(cambiosLead.datos_capturados_merge?.otros ?? {}),
        ...otrosDetectados,
      },
    };
    const lista = Object.entries(otrosDetectados)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    partesMensajeSistemaCRM.push(`✓ Detectados (heurística): ${lista}`);
  }

  // Helper: normaliza texto para comparación (sin acentos, sin espacios
  // extra, lowercase). "contratar a Joshua González" === "contratar  a
  // joshua gonzalez".
  function normalizar(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  if (respuesta.capturar_datos?.activar) {
    const cd = respuesta.capturar_datos;
    const merge: Record<string, string> = {};
    const mostrar: string[] = [];
    const silenciados: string[] = [];

    const map: Array<[keyof typeof cd, string]> = [
      ["nombre", "nombre"],
      ["email", "email"],
      ["telefono_alt", "tel. alt"],
      ["interes", "interés"],
      ["negocio", "negocio"],
      ["ventajas", "ventajas"],
      ["miedos", "miedos"],
    ];
    for (const [campo, label] of map) {
      const v = (cd[campo] as string)?.trim();
      if (!v) continue;
      // Dedupe robusto: comparamos sin acentos, sin casing, sin espacios
      // extra. La IA suele re-capturar el mismo valor con variaciones
      // mínimas — eso ensucia el panel y los logs.
      const yaCapturado = (datosYaCapturados[campo as keyof typeof datosYaCapturados] as string | undefined)?.trim();
      if (yaCapturado && normalizar(yaCapturado) === normalizar(v)) {
        silenciados.push(label);
        continue;
      }
      merge[campo] = v;
      mostrar.push(`${label}: ${v}`);
    }

    // "otros" viene como string libre tipo "ciudad: Bogotá; equipo: 5".
    const otrosStr = cd.otros?.trim();
    if (otrosStr) {
      const otros: Record<string, string> = {};
      const otrosYa = datosYaCapturados.otros ?? {};
      for (const par of otrosStr.split(";")) {
        const i = par.indexOf(":");
        if (i <= 0) continue;
        const k = par.slice(0, i).trim();
        const v = par.slice(i + 1).trim();
        if (!k || !v) continue;
        const yaVal = otrosYa[k]?.trim();
        if (yaVal && normalizar(yaVal) === normalizar(v)) {
          silenciados.push(k);
          continue;
        }
        otros[k] = v;
        mostrar.push(`${k}: ${v}`);
      }
      if (Object.keys(otros).length > 0) {
        cambiosLead.datos_capturados_merge = {
          ...(cambiosLead.datos_capturados_merge ?? {}),
          otros: {
            ...(cambiosLead.datos_capturados_merge?.otros ?? {}),
            ...otros,
          },
        };
      }
    }

    if (Object.keys(merge).length > 0) {
      cambiosLead.datos_capturados_merge = {
        ...(cambiosLead.datos_capturados_merge ?? {}),
        ...merge,
      };
      if (merge.nombre) cambiosLead.nombre = merge.nombre;
    }

    if (silenciados.length > 0) {
      console.log(
        `${prefijo} 🔇 captura silenciada (datos ya guardados): [${silenciados.join(", ")}]`,
      );
    }

    // SOLO mostramos mensaje sistema si capturamos algo NUEVO.
    // Si la IA insistió con datos viejos pero no agregó nada nuevo,
    // no spameamos el panel.
    if (mostrar.length > 0) {
      partesMensajeSistemaCRM.push(`✓ Datos guardados: ${mostrar.join(", ")}`);
    }
  }

  if (respuesta.actualizar_score?.activar) {
    const s = respuesta.actualizar_score;
    if (Number.isFinite(s.score)) {
      cambiosLead.lead_score = s.score;
      partesMensajeSistemaCRM.push(
        `📊 Lead score → ${Math.round(s.score)}/100${s.motivo ? ` (${s.motivo})` : ""}`,
      );
    }
  }

  if (respuesta.cambiar_estado?.activar && respuesta.cambiar_estado.nuevo_estado) {
    const ce = respuesta.cambiar_estado;
    const estadosValidos: EstadoLead[] = [
      "nuevo",
      "contactado",
      "calificado",
      "interesado",
      "negociacion",
      "cerrado",
      "perdido",
    ];
    if (estadosValidos.includes(ce.nuevo_estado as EstadoLead)) {
      cambiosLead.estado_lead = ce.nuevo_estado as EstadoLead;
      partesMensajeSistemaCRM.push(
        `🎯 Estado del lead → ${ce.nuevo_estado}${ce.motivo ? ` (${ce.motivo})` : ""}`,
      );
    }
  }

  if (Object.keys(cambiosLead).length > 0) {
    try {
      const actualizada = await actualizarLead(conversacion.id, cambiosLead);
      console.log(
        `${prefijo} 🧬 lead actualizado: ${JSON.stringify(cambiosLead).slice(0, 200)}`,
      );
      // Webhook contacto_actualizado para integraciones (n8n, etc).
      if (actualizada) {
        dispararWebhook(cuenta.id, "contacto_actualizado", {
          conversacion_id: conversacion.id,
          telefono: conversacion.telefono,
          nombre: actualizada.nombre,
          lead_score: actualizada.lead_score,
          estado_lead: actualizada.estado_lead,
          datos_capturados: actualizada.datos_capturados,
        });
      }
    } catch (err) {
      console.error(`${prefijo} error actualizando lead:`, err);
    }
  }

  if (partesMensajeSistemaCRM.length > 0) {
    try {
      await insertarMensaje(
        cuenta.id,
        conversacion.id,
        "sistema",
        partesMensajeSistemaCRM.join(" | "),
        { tipo: "sistema" },
      );
    } catch {}
  }
}
