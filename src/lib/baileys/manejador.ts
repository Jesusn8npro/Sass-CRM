import {
  getAudioDuration,
  getAudioWaveform,
  type WASocket,
  type proto,
  type WAMessage,
} from "@whiskeysockets/baileys";
import {
  actualizarCita,
  actualizarLead,
  contarMensajesDeConversacion,
  crearCita,
  crearLlamadaProgramada,
  crearSeguimiento,
  extraerEmailsDelTexto,
  extraerTelefonosDelTexto,
  guardarContactosEmail,
  guardarContactosTelefono,
  insertarMensaje,
  listarBiblioteca,
  listarCitasActivasDeConversacion,
  listarProductosActivos,
  marcarConversacionNecesitaHumano,
  obtenerCita,
  obtenerOCrearConversacion,
  obtenerConversacionPorId,
  obtenerHistorialReciente,
  obtenerMedioPorIdentificador,
  obtenerPendientesBandejaDeCuenta,
  obtenerCuenta,
  obtenerProducto,
  listarConocimientoDeCuenta,
  marcarBandejaEnviado,
  registrarInteresEnProducto,
  type Cita,
  type Conversacion,
  type Cuenta,
  type EstadoLead,
  type FilaBandejaSalida,
  type MedioBiblioteca,
  type TipoMensaje,
} from "../baseDatos";
import { generarRespuesta, type RespuestaIA } from "../openai";
import { construirPromptSistema } from "../construirPrompt";
import { iniciarLlamadaConContexto } from "../llamadas";
import { dispararWebhook } from "../webhooks";
import {
  borrarTemporal,
  descargarBiblioteca,
  descargarMediaChat,
  descargarYGuardarMedia,
  desempacarMensaje,
  detectarTipoMedia,
  escribirTemporal,
  guardarMediaSubido,
  transcribirAudio,
} from "./medios";
import { readFile as fsReadFileAsync } from "node:fs/promises";
import { generarAudioTTS } from "../elevenlabs";
import { asegurarFormatoVoz } from "./conversion";

function extraerTexto(mensaje: proto.IMessage | null | undefined): string | null {
  // Desempacar wrappers ephemeral/viewOnce/etc antes de extraer
  const inner = desempacarMensaje(mensaje);
  if (!inner) return null;
  if (inner.conversation) return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;
  return null;
}

function telefonoDesdeJID(jid: string): string {
  const sinSufijo = jid.split("@")[0] ?? "";
  return sinSufijo.split(":")[0] ?? "";
}

interface ClaveMensajeExtendida {
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  senderPn?: string | null;
  fromMe?: boolean | null;
}

function resolverIdentidad(clave: ClaveMensajeExtendida): {
  jidParaEnviar: string;
  telefonoMostrable: string;
} | null {
  const remoteJid = clave.remoteJid;
  if (!remoteJid) return null;
  const jidParaEnviar = remoteJid;
  if (remoteJid.endsWith("@s.whatsapp.net")) {
    return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(remoteJid) };
  }
  const candidatos = [clave.remoteJidAlt, clave.senderPn].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  for (const cand of candidatos) {
    if (cand.endsWith("@s.whatsapp.net")) {
      return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(cand) };
    }
  }
  return { jidParaEnviar, telefonoMostrable: telefonoDesdeJID(remoteJid) };
}

const timersBuffer = new Map<string, NodeJS.Timeout>();
function cancelarTimer(conversacionId: string): void {
  const t = timersBuffer.get(conversacionId);
  if (t) {
    clearTimeout(t);
    timersBuffer.delete(conversacionId);
  }
}

// ============================================================
// Tracker de IDs que enviamos nosotros (bot IA o humano vía panel).
// WhatsApp nos rebota nuestros propios envíos como messages.upsert con
// fromMe=true. Sin este tracker NO podríamos distinguir entre:
//   (a) mensaje enviado por nuestro código (ya guardado en DB)
//   (b) mensaje tipeado manualmente desde el celular conectado
// (b) sí queremos guardarlo para que aparezca en el panel como humano.
// (a) lo descartamos para no duplicar.
// ============================================================
const idsEnviadosPorBot = new Map<string, Set<string>>();
const TTL_TRACKING_MS = 10 * 60 * 1000;

export function recordarEnvioBot(
  cuentaId: string,
  msgId: string | null | undefined,
): void {
  if (!msgId) return;
  let s = idsEnviadosPorBot.get(cuentaId);
  if (!s) {
    s = new Set();
    idsEnviadosPorBot.set(cuentaId, s);
  }
  s.add(msgId);
  setTimeout(() => s.delete(msgId), TTL_TRACKING_MS);
}

function fueEnviadoPorNosotros(
  cuentaId: string,
  msgId: string | null | undefined,
): boolean {
  if (!msgId) return false;
  return !!idsEnviadosPorBot.get(cuentaId)?.has(msgId);
}

// ============================================================
// Procesar mensaje multimedia entrante (audio/imagen/video/documento)
// Devuelve el contenido en texto que se va a guardar en mensajes.contenido
// (transcripción si es audio, caption o "[imagen]" si no hay caption, etc).
// ============================================================
async function procesarMediaEntrante(
  sock: WASocket,
  msg: WAMessage,
  cuentaId: string,
  prefijo: string,
): Promise<{
  tipo: TipoMensaje;
  contenido: string;
  mediaPath: string | null;
} | null> {
  const info = detectarTipoMedia(msg);
  if (!info) return null;

  const descargado = await descargarYGuardarMedia(
    sock,
    msg,
    cuentaId,
    info.tipo,
    info.mime,
  );
  if (!descargado) {
    return {
      tipo: info.tipo,
      contenido: `[${info.tipo} no pudo descargarse]`,
      mediaPath: null,
    };
  }

  let contenido = info.caption ?? "";

  if (info.tipo === "audio") {
    console.log(`${prefijo} 🎤 transcribiendo audio (${descargado.tamano} bytes)...`);
    const inicio = Date.now();
    const texto = await transcribirAudio(
      descargado.buffer,
      descargado.nombreArchivo,
    );
    const dur = Date.now() - inicio;
    if (texto) {
      console.log(`${prefijo} ✓ transcripción (${dur}ms): "${texto.slice(0, 80)}"`);
      contenido = texto;
    } else {
      contenido = "[audio sin transcripción]";
    }
  } else if (!contenido) {
    contenido =
      info.tipo === "imagen"
        ? "[imagen sin descripción]"
        : info.tipo === "video"
        ? "[video sin descripción]"
        : "[documento]";
  }

  return {
    tipo: info.tipo,
    contenido,
    mediaPath: descargado.rutaRelativa,
  };
}

// ============================================================
// Generar respuesta con IA y enviar como múltiples partes
// ============================================================
async function generarYEnviarRespuesta(
  sock: WASocket,
  cuenta: Cuenta,
  conversacion: Conversacion,
  jidParaEnviar: string,
  prefijo: string,
): Promise<void> {
  const historial = await obtenerHistorialReciente(conversacion.id, 20);
  console.log(`${prefijo} llamando LLM con ${historial.length} mensajes...`);

  try {
    await sock.presenceSubscribe(jidParaEnviar);
  } catch {}
  try {
    await sock.sendPresenceUpdate("composing", jidParaEnviar);
  } catch {}

  const conocimiento = await listarConocimientoDeCuenta(cuenta.id);
  const biblioteca = await listarBiblioteca(cuenta.id);
  const productos = await listarProductosActivos(cuenta.id);
  const citasActivas = await listarCitasActivasDeConversacion(conversacion.id);
  const promptCompleto = construirPromptSistema(
    cuenta,
    conocimiento,
    biblioteca,
    productos,
    conversacion,
    citasActivas,
  );

  const inicio = Date.now();
  let respuesta: RespuestaIA;
  try {
    respuesta = await generarRespuesta(
      historial,
      promptCompleto,
      cuenta.modelo,
      {
        temperatura: cuenta.temperatura,
        max_tokens: cuenta.max_tokens,
      },
    );
  } catch (err) {
    const detalle =
      err instanceof Error ? err.message : JSON.stringify(err);
    console.error(`${prefijo} ✗ error llamando OpenAI: ${detalle}`);
    if (detalle.includes("401") || detalle.includes("invalid_api_key")) {
      console.error(
        `${prefijo}   → OPENAI_API_KEY inválida o revocada. Verificá .env.local.`,
      );
    } else if (detalle.includes("429") || detalle.includes("quota")) {
      console.error(
        `${prefijo}   → Sin créditos en OpenAI o rate limit. Recargá saldo en https://platform.openai.com/account/billing`,
      );
    } else if (detalle.includes("model") && detalle.includes("not found")) {
      console.error(
        `${prefijo}   → Modelo "${cuenta.modelo ?? "default"}" no existe o tu cuenta no tiene acceso. Cambialo a 'gpt-4o-mini' en /configuracion → Comportamiento.`,
      );
    }
    try {
      await sock.sendPresenceUpdate("paused", jidParaEnviar);
    } catch {}
    return;
  }
  const duracion = Date.now() - inicio;
  // Log detallado de qué tools activó la IA — esencial para diagnosticar
  // por qué no captura datos. Si todo viene en false, hay que revisar
  // el prompt o el modelo.
  const toolsDisparadas: string[] = [];
  if (respuesta.transferir_a_humano?.activar) toolsDisparadas.push("HANDOFF");
  if (respuesta.iniciar_llamada?.activar) toolsDisparadas.push("LLAMAR_YA");
  if (respuesta.agendar_llamada?.activar) toolsDisparadas.push("LLAMADA_FUTURA");
  if (respuesta.agendar_cita?.activar) toolsDisparadas.push("CITA");
  if (respuesta.reprogramar_cita?.activar) toolsDisparadas.push("REPROG_CITA");
  if (respuesta.cancelar_cita?.activar) toolsDisparadas.push("CANCEL_CITA");
  if (respuesta.programar_seguimiento?.activar)
    toolsDisparadas.push("SEGUIMIENTO");
  if (respuesta.capturar_datos?.activar) {
    const c = respuesta.capturar_datos;
    const camposLlenos: string[] = [];
    if (c.nombre?.trim()) camposLlenos.push(`nombre="${c.nombre}"`);
    if (c.email?.trim()) camposLlenos.push(`email="${c.email}"`);
    if (c.telefono_alt?.trim()) camposLlenos.push(`tel_alt="${c.telefono_alt}"`);
    if (c.interes?.trim()) camposLlenos.push(`interes="${c.interes.slice(0, 30)}"`);
    if (c.negocio?.trim()) camposLlenos.push(`negocio="${c.negocio.slice(0, 30)}"`);
    if (c.ventajas?.trim()) camposLlenos.push("ventajas+");
    if (c.miedos?.trim()) camposLlenos.push("miedos+");
    if (c.otros?.trim()) camposLlenos.push(`otros="${c.otros.slice(0, 40)}"`);
    toolsDisparadas.push(`CAPTURA[${camposLlenos.join(", ")}]`);
  }
  if (respuesta.actualizar_score?.activar) {
    toolsDisparadas.push(`SCORE→${respuesta.actualizar_score.score}`);
  }
  if (respuesta.cambiar_estado?.activar && respuesta.cambiar_estado.nuevo_estado) {
    toolsDisparadas.push(`ESTADO→${respuesta.cambiar_estado.nuevo_estado}`);
  }
  if (
    Array.isArray(respuesta.productos_de_interes) &&
    respuesta.productos_de_interes.length > 0
  ) {
    toolsDisparadas.push(`PRODS×${respuesta.productos_de_interes.length}`);
  }
  console.log(
    `${prefijo} LLM respondió en ${duracion}ms (${respuesta.partes.length} parte${respuesta.partes.length === 1 ? "" : "s"}) tools=[${toolsDisparadas.join(" ") || "ninguna"}]`,
  );

  // Despachar cada parte según su tipo. La AI eligió una mezcla de
  // texto / audio / media (ver instrucciones en openai.ts). Ya no hay
  // "modo espejo binario" que convierta toda la respuesta a voz.
  const tieneVoz =
    !!cuenta.voz_elevenlabs && cuenta.voz_elevenlabs.trim().length > 0;
  const tieneApiKeyEleven = !!process.env.ELEVENLABS_API_KEY;
  const puedeUsarVoz = tieneVoz && tieneApiKeyEleven;

  for (let i = 0; i < respuesta.partes.length; i++) {
    const parte = respuesta.partes[i]!;
    const esUltima = i === respuesta.partes.length - 1;
    const numParte = `${i + 1}/${respuesta.partes.length}`;

    if (parte.tipo === "media") {
      const idRaw = parte.media_id?.trim() ?? "";
      if (!idRaw) {
        console.warn(`${prefijo} parte ${numParte} media con id vacío, ignorada`);
      } else {
        const medio = await obtenerMedioPorIdentificador(cuenta.id, idRaw);
        if (!medio) {
          console.warn(
            `${prefijo} parte ${numParte} media id="${idRaw}" no existe en biblioteca, ignorada`,
          );
        } else {
          await dormir(1000);
          await enviarMedioBiblioteca(
            sock,
            jidParaEnviar,
            medio,
            cuenta.id,
            conversacion.id,
            prefijo,
          );
        }
      }
    } else if (parte.tipo === "audio" && parte.contenido.trim()) {
      // Si la cuenta no tiene voz configurada, caemos a texto.
      const exito = puedeUsarVoz
        ? await enviarParteAudio(
            sock,
            cuenta,
            conversacion.id,
            jidParaEnviar,
            parte.contenido.trim(),
            prefijo,
            numParte,
          )
        : false;
      if (!exito) {
        if (!puedeUsarVoz) {
          console.log(
            `${prefijo} parte ${numParte} pedida como audio pero falta voz_elevenlabs/API key → texto`,
          );
        }
        await enviarParteTexto(
          sock,
          cuenta.id,
          conversacion.id,
          jidParaEnviar,
          parte.contenido,
          prefijo,
          numParte,
        );
      }
    } else if (parte.contenido.trim()) {
      await enviarParteTexto(
        sock,
        cuenta.id,
        conversacion.id,
        jidParaEnviar,
        parte.contenido,
        prefijo,
        numParte,
      );
    }

    if (!esUltima) {
      try {
        await sock.sendPresenceUpdate("composing", jidParaEnviar);
      } catch {}
    } else {
      try {
        await sock.sendPresenceUpdate("paused", jidParaEnviar);
      } catch {}
    }
  }

  // Si el LLM detectó que el cliente preguntó por productos, registrar
  // interés (cliente_360 lo lista, dashboard lo agrega a "productos top").
  if (
    Array.isArray(respuesta.productos_de_interes) &&
    respuesta.productos_de_interes.length > 0
  ) {
    for (const idRaw of respuesta.productos_de_interes) {
      const id = typeof idRaw === "string" ? idRaw.trim() : "";
      if (!id) continue;
      const prod = await obtenerProducto(id);
      if (!prod || prod.cuenta_id !== cuenta.id) continue;
      try {
        await registrarInteresEnProducto(conversacion.id, prod.id, cuenta.id);
        console.log(
          `${prefijo} 🛍 interés registrado: producto "${prod.nombre}" (id ${prod.id})`,
        );
      } catch (err) {
        console.error(`${prefijo} error registrando interés:`, err);
      }
    }
  }

  // Si el LLM decidió transferir a humano, ejecutar el handoff
  if (respuesta.transferir_a_humano.activar) {
    const razon =
      respuesta.transferir_a_humano.razon?.trim() || "Sin razón provista";
    console.log(`${prefijo} 🤝 HANDOFF a humano: ${razon}`);
    await marcarConversacionNecesitaHumano(conversacion.id, razon);
    dispararWebhook(cuenta.id, "handoff_humano", {
      conversacion_id: conversacion.id,
      telefono: conversacion.telefono,
      nombre: conversacion.nombre,
      razon,
    });
  }

  // Si el LLM decidió iniciar una llamada Vapi, dispararla con el
  // contexto de la conversación (cooldown 1h por conversación).
  if (respuesta.iniciar_llamada?.activar) {
    const razon = respuesta.iniciar_llamada.razon?.trim() || null;
    console.log(`${prefijo} 📞 IA pide iniciar llamada: ${razon ?? "—"}`);
    try {
      const r = await iniciarLlamadaConContexto({
        cuenta,
        conversacion,
        motivo: razon,
        origen: "ia",
      });
      if (r.ok) {
        console.log(
          `${prefijo} ✓ llamada Vapi disparada por IA (call_id ${r.llamada?.vapi_call_id})`,
        );
      } else {
        console.warn(
          `${prefijo} ✗ no se inició llamada (${r.motivoBloqueo}): ${r.error}`,
        );
        // Si fue por cooldown, dejamos un mensaje sistema para que se
        // entienda en el panel por qué la IA no llamó.
        if (r.motivoBloqueo === "cooldown") {
          try {
            await insertarMensaje(
              cuenta.id,
              conversacion.id,
              "sistema",
              `[IA quiso llamar pero hay otra llamada reciente, cooldown activo]`,
              { tipo: "sistema" },
            );
          } catch {}
        }
      }
    } catch (err) {
      console.error(`${prefijo} error disparando llamada IA:`, err);
    }
  }

  // Programar seguimiento futuro si la IA lo decidió
  if (respuesta.programar_seguimiento?.activar) {
    const ps = respuesta.programar_seguimiento;
    const fecha = parseFechaIso(ps.fecha_iso);
    if (fecha === null) {
      console.warn(
        `${prefijo} ⚠ programar_seguimiento con fecha_iso inválida: "${ps.fecha_iso}"`,
      );
    } else if (!ps.contenido?.trim()) {
      console.warn(`${prefijo} ⚠ programar_seguimiento sin contenido, ignorado`);
    } else {
      try {
        const s = await crearSeguimiento(
          cuenta.id,
          conversacion.id,
          ps.contenido.trim(),
          fecha,
          "ia",
        );
        console.log(
          `${prefijo} ⏰ seguimiento ${s.id} programado para ${new Date(fecha).toISOString()}: ${ps.razon ?? ""}`,
        );
      } catch (err) {
        console.error(`${prefijo} error programando seguimiento:`, err);
      }
    }
  }

  // Agendar cita si la IA lo decidió
  // ANTI-DUPLICADO: si ya hay una cita activa de esta conversación
  // cerca de la fecha que pide la IA (±2h), NO creamos una nueva —
  // actualizamos la existente. Evita el bug donde la IA dispara
  // agendar_cita cada vez que el cliente confirma o agrega info.
  if (respuesta.agendar_cita?.activar) {
    const ac = respuesta.agendar_cita;
    const fecha = parseFechaIso(ac.fecha_iso);
    if (fecha === null) {
      console.warn(
        `${prefijo} ⚠ agendar_cita con fecha_iso inválida: "${ac.fecha_iso}"`,
      );
    } else {
      try {
        const fechaTs = new Date(fecha).getTime();
        const VENTANA_MS = 2 * 60 * 60 * 1000; // ±2 horas
        const citaExistente = citasActivas.find(
          (c) => Math.abs(new Date(c.fecha_hora).getTime() - fechaTs) < VENTANA_MS,
        );

        if (citaExistente) {
          // Mergear notas: si la IA mandó info nueva, la agregamos a las
          // notas existentes en vez de duplicar la cita.
          const notasNuevas = ac.notas?.trim() || "";
          const tipoNuevo = ac.tipo?.trim() || citaExistente.tipo;
          const notasMerged = notasNuevas
            ? citaExistente.notas?.trim()
              ? citaExistente.notas.trim() === notasNuevas
                ? citaExistente.notas
                : `${citaExistente.notas} | ${notasNuevas}`
              : notasNuevas
            : citaExistente.notas;
          // Solo actualizamos si HAY cambio real (notas o tipo distintos)
          const huboCambio =
            notasMerged !== citaExistente.notas || tipoNuevo !== citaExistente.tipo;
          if (huboCambio) {
            await actualizarCita(citaExistente.id, {
              notas: notasMerged,
              tipo: tipoNuevo,
            });
            console.log(
              `${prefijo} 📅↺ cita existente ${citaExistente.id} actualizada (no se duplicó)`,
            );
            await insertarMensaje(
              cuenta.id,
              conversacion.id,
              "sistema",
              `📅 Cita actualizada: ${tipoNuevo || "(sin tipo)"}${notasNuevas ? ` — ${notasNuevas}` : ""}`,
              { tipo: "sistema" },
            );
          } else {
            console.log(
              `${prefijo} 📅= cita existente ${citaExistente.id} ya tiene la misma info, no se actualiza ni duplica`,
            );
          }
        } else {
          // No hay cita cerca → crear nueva
          const c = await crearCita(cuenta.id, {
            conversacion_id: conversacion.id,
            cliente_nombre: conversacion.nombre ?? `+${conversacion.telefono}`,
            cliente_telefono: conversacion.telefono,
            fecha_hora: fecha,
            duracion_min: ac.duracion_min > 0 ? ac.duracion_min : 30,
            tipo: ac.tipo?.trim() || null,
            notas: ac.notas?.trim() || null,
          });
          console.log(
            `${prefijo} 📅 cita ${c.id} agendada: ${new Date(fecha).toISOString()} (${ac.tipo})`,
          );
          dispararWebhook(cuenta.id, "cita_agendada", {
            cita_id: c.id,
            conversacion_id: conversacion.id,
            cliente_nombre: c.cliente_nombre,
            cliente_telefono: c.cliente_telefono,
            fecha_hora: c.fecha_hora,
            duracion_min: c.duracion_min,
            tipo: c.tipo,
            notas: c.notas,
          });
          // Mensaje sistema visible en el panel
          try {
            await insertarMensaje(
              cuenta.id,
              conversacion.id,
              "sistema",
              `📅 Cita agendada: ${ac.tipo || "(sin tipo)"} el ${new Date(fecha).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}${ac.notas ? ` — ${ac.notas}` : ""}`,
              { tipo: "sistema" },
            );
          } catch {}
        }
      } catch (err) {
        console.error(`${prefijo} error agendando cita:`, err);
      }
    }
  }

  // Agendar llamada Vapi a futuro si la IA lo decidió.
  // (distinto de iniciar_llamada que dispara YA — agendar_llamada
  //  programa para una fecha futura. El scheduler la dispara.)
  if (respuesta.agendar_llamada?.activar) {
    const al = respuesta.agendar_llamada;
    const fecha = parseFechaIso(al.fecha_iso);
    if (fecha === null) {
      console.warn(
        `${prefijo} ⚠ agendar_llamada con fecha_iso inválida: "${al.fecha_iso}"`,
      );
    } else {
      try {
        const lp = await crearLlamadaProgramada(cuenta.id, {
          conversacion_id: conversacion.id,
          motivo: al.motivo?.trim() || null,
          origen: "ia",
          programada_para: fecha,
        });
        console.log(
          `${prefijo} 📞⏰ llamada agendada ${lp.id} para ${new Date(fecha).toISOString()}: ${al.motivo}`,
        );
        try {
          await insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            `📞⏰ Llamada agendada para ${new Date(fecha).toLocaleString(
              "es-ES",
              {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              },
            )}${al.motivo ? ` — ${al.motivo}` : ""}`,
            { tipo: "sistema" },
          );
        } catch {}
      } catch (err) {
        console.error(`${prefijo} error agendando llamada:`, err);
      }
    }
  }

  // ============================================================
  // CRM: capturar datos / score / estado / paso del lead
  // ============================================================
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

  // ============================================================
  // Reprogramar cita
  // ============================================================
  // Helper: la IA a veces manda una FECHA en cita_id en vez del UUID.
  // Si lo detectamos, intentamos resolver mirando las citas activas y
  // matcheando por fecha. Como último recurso usamos la única cita activa.
  const RE_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  async function resolverCitaId(idCandidato: string): Promise<string | null> {
    const v = idCandidato?.trim() ?? "";
    if (RE_UUID.test(v)) return v;
    // No es UUID — la IA mandó algo raro (típico: fecha de la cita).
    // Buscamos en citas activas de esta conversación.
    if (citasActivas.length === 0) return null;
    if (citasActivas.length === 1) {
      console.log(
        `${prefijo} 🔧 cita_id no era UUID ("${v}"), usando única cita activa: ${citasActivas[0]!.id}`,
      );
      return citasActivas[0]!.id;
    }
    // Múltiples citas: matchear por fecha si v parece una fecha ISO
    const ts = new Date(v).getTime();
    if (Number.isFinite(ts)) {
      const match = citasActivas.find(
        (c) => Math.abs(new Date(c.fecha_hora).getTime() - ts) < 86400 * 1000,
      );
      if (match) {
        console.log(
          `${prefijo} 🔧 cita_id no era UUID ("${v}"), matcheado por fecha: ${match.id}`,
        );
        return match.id;
      }
    }
    return null;
  }

  if (respuesta.reprogramar_cita?.activar) {
    const rc = respuesta.reprogramar_cita;
    const fecha = parseFechaIso(rc.nueva_fecha_iso);
    const citaIdResuelto = await resolverCitaId(rc.cita_id);
    if (!citaIdResuelto || fecha === null) {
      console.warn(
        `${prefijo} ⚠ reprogramar_cita ignorada (cita_id="${rc.cita_id}" → resuelto="${citaIdResuelto}", fecha="${rc.nueva_fecha_iso}" → ${fecha})`,
      );
    } else {
      try {
        const cita = await obtenerCita(citaIdResuelto);
        if (!cita || cita.cuenta_id !== cuenta.id) {
          console.warn(
            `${prefijo} ⚠ reprogramar_cita: cita ${citaIdResuelto} no existe o no pertenece a esta cuenta`,
          );
        } else {
          await actualizarCita(citaIdResuelto, {
            fecha_hora: fecha,
            recordatorio_enviado: false, // re-disparar recordatorio para la nueva hora
          });
          dispararWebhook(cuenta.id, "cita_modificada", {
            cita_id: citaIdResuelto,
            conversacion_id: conversacion.id,
            cliente_nombre: cita.cliente_nombre,
            cliente_telefono: cita.cliente_telefono,
            fecha_hora_anterior: cita.fecha_hora,
            fecha_hora: fecha,
            motivo: rc.motivo,
          });
          await insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            `📅 Cita reprogramada: ${new Date(fecha).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}${rc.motivo ? ` — ${rc.motivo}` : ""}`,
            { tipo: "sistema" },
          );
          console.log(
            `${prefijo} 📅↻ cita ${citaIdResuelto} reprogramada a ${new Date(fecha).toISOString()}`,
          );
        }
      } catch (err) {
        console.error(`${prefijo} error reprogramando cita:`, err);
      }
    }
  }

  // ============================================================
  // Cancelar cita
  // ============================================================
  if (respuesta.cancelar_cita?.activar && respuesta.cancelar_cita.cita_id) {
    const cc = respuesta.cancelar_cita;
    const citaIdCancelar = await resolverCitaId(cc.cita_id);
    if (!citaIdCancelar) {
      console.warn(
        `${prefijo} ⚠ cancelar_cita ignorada — no se pudo resolver cita_id="${cc.cita_id}"`,
      );
    } else {
      try {
        const cita = await obtenerCita(citaIdCancelar);
        if (!cita || cita.cuenta_id !== cuenta.id) {
          console.warn(
            `${prefijo} ⚠ cancelar_cita: cita ${citaIdCancelar} no existe o no pertenece a esta cuenta`,
          );
        } else {
          await actualizarCita(citaIdCancelar, { estado: "cancelada" });
          dispararWebhook(cuenta.id, "cita_cancelada", {
            cita_id: citaIdCancelar,
            conversacion_id: conversacion.id,
            cliente_nombre: cita.cliente_nombre,
            cliente_telefono: cita.cliente_telefono,
            fecha_hora: cita.fecha_hora,
            motivo: cc.motivo,
          });
          await insertarMensaje(
            cuenta.id,
            conversacion.id,
            "sistema",
            `📅✗ Cita cancelada${cc.motivo ? ` — ${cc.motivo}` : ""}`,
            { tipo: "sistema" },
          );
          console.log(
            `${prefijo} 📅✗ cita ${citaIdCancelar} cancelada${cc.motivo ? `: ${cc.motivo}` : ""}`,
          );
        }
      } catch (err) {
        console.error(`${prefijo} error cancelando cita:`, err);
      }
    }
  }
}

function parseFechaIso(iso: string | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  let ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  const ahora = Date.now();
  const limiteFuturo = ahora + 365 * 86400 * 1000;
  const limiteMin = ahora + 5 * 60 * 1000;

  // [v2] Auto-corrección agresiva: si la IA mandó una fecha pasada
  // (típico bug por training cutoff donde asume año 2024), la rescatamos
  // moviendo el año al actual; si sigue pasada, al próximo año. Es
  // tolerante: corrige UN AÑO A LA VEZ hasta encontrar una fecha futura
  // dentro del rango (evita loops si la IA mandó algo absurdo como año 1).
  if (ms < limiteMin) {
    console.log(
      `[parseFechaIso] ⚠ fecha pasada recibida: "${iso}" — intentando auto-corregir...`,
    );
    const d = new Date(iso);
    if (Number.isFinite(d.getTime())) {
      const añoActual = new Date().getFullYear();
      // Probamos año actual, próximo, +2... hasta caer en rango futuro
      // dentro de 365 días o agotar 3 intentos.
      for (let delta = 0; delta <= 2; delta++) {
        const intento = new Date(d);
        intento.setFullYear(añoActual + delta);
        if (
          intento.getTime() >= limiteMin &&
          intento.getTime() <= limiteFuturo
        ) {
          console.log(
            `[parseFechaIso] ✓ auto-corregido: "${iso}" → "${intento.toISOString()}" (año ${añoActual + delta})`,
          );
          ms = intento.getTime();
          break;
        }
      }
    }
    if (ms < limiteMin) {
      console.warn(
        `[parseFechaIso] ✗ no se pudo auto-corregir "${iso}" — fuera de rango incluso ajustando año`,
      );
    }
  }

  // Validación final
  if (ms < limiteMin) return null;
  if (ms > limiteFuturo) return null;
  return new Date(ms).toISOString();
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía una parte de texto del bot: calcula un delay natural según
 * largo, guarda en DB y envía por Baileys. No emite presence updates
 * (eso lo hace el caller entre partes).
 */
async function enviarParteTexto(
  sock: WASocket,
  cuentaId: string,
  conversacionId: string,
  jid: string,
  contenido: string,
  prefijo: string,
  numParte: string,
): Promise<void> {
  const charsPorSegundo = 35;
  const delayMs = Math.min(
    4000,
    Math.max(800, (contenido.length / charsPorSegundo) * 1000),
  );
  await dormir(delayMs);

  await insertarMensaje(cuentaId, conversacionId, "asistente", contenido);
  try {
    const enviado = await sock.sendMessage(jid, { text: contenido });
    recordarEnvioBot(cuentaId, enviado?.key?.id);
    console.log(`${prefijo} → parte ${numParte} (texto) enviada`);
  } catch (err) {
    console.error(`${prefijo} error enviando parte ${numParte} texto:`, err);
  }
}

/**
 * Envía una parte como nota de voz: pide TTS a ElevenLabs, convierte
 * el MP3 a OGG/Opus, guarda en DB y manda por Baileys con metadata
 * (seconds + waveform) para que WhatsApp lo muestre como nota de voz.
 * Devuelve true si se envió OK, false si falló (caller hace fallback).
 */
async function enviarParteAudio(
  sock: WASocket,
  cuenta: Cuenta,
  conversacionId: string,
  jid: string,
  texto: string,
  prefijo: string,
  numParte: string,
): Promise<boolean> {
  let archivoTempEntrada: string | null = null;
  let archivoTempSalida: string | null = null;
  try {
    try {
      await sock.sendPresenceUpdate("recording", jid);
    } catch {}
    const ttsInicio = Date.now();
    const tts = await generarAudioTTS(texto, cuenta.voz_elevenlabs!);
    const ttsDur = Date.now() - ttsInicio;
    console.log(
      `${prefijo} 🔊 parte ${numParte} TTS (${tts.buffer.length}b, ${ttsDur}ms)`,
    );

    // Para correr ffmpeg necesitamos un archivo real en disco.
    // Lo escribimos en os.tmpdir(), procesamos, y subimos el
    // resultado a Storage (bucket media-chats).
    archivoTempEntrada = escribirTemporal(tts.buffer, tts.extension);
    let rutaParaMeta = archivoTempEntrada;
    let bufferFinal = tts.buffer;
    let extFinal = tts.extension;
    try {
      const conv = await asegurarFormatoVoz(archivoTempEntrada);
      if (conv.rutaAbsoluta !== archivoTempEntrada) {
        archivoTempSalida = conv.rutaAbsoluta;
        rutaParaMeta = conv.rutaAbsoluta;
        bufferFinal = await fsReadFileAsync(conv.rutaAbsoluta);
        extFinal = conv.nombre.split(".").pop() ?? extFinal;
      }
    } catch (errConv) {
      console.warn(`${prefijo} no se pudo convertir TTS:`, errConv);
    }

    const guardado = await guardarMediaSubido(cuenta.id, bufferFinal, extFinal);
    const mediaPathTTS = guardado.rutaRelativa;

    await insertarMensaje(cuenta.id, conversacionId, "asistente", texto, {
      tipo: "audio",
      media_path: mediaPathTTS,
    });

    const meta = await obtenerMetadataAudio(rutaParaMeta);
    const contenidoTTS = {
      audio: bufferFinal,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      seconds: meta.seconds,
      waveform: meta.waveform,
    } as unknown as Parameters<typeof sock.sendMessage>[1];
    const enviado = await sock.sendMessage(jid, contenidoTTS);
    recordarEnvioBot(cuenta.id, enviado?.key?.id);
    console.log(
      `${prefijo} → parte ${numParte} (audio) enviada (${meta.seconds}s)`,
    );
    return true;
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error(
      `${prefijo} error parte ${numParte} audio (ElevenLabs):`,
      detalle,
    );
    try {
      await insertarMensaje(
        cuenta.id,
        conversacionId,
        "sistema",
        `[ElevenLabs falló: ${detalle.slice(0, 200)}] — fallback a texto.`,
        { tipo: "sistema" },
      );
    } catch {}
    return false;
  } finally {
    if (archivoTempEntrada) borrarTemporal(archivoTempEntrada);
    if (archivoTempSalida) borrarTemporal(archivoTempSalida);
  }
}

/**
 * Envía un medio de la biblioteca de la cuenta como mensaje del bot.
 * Inserta también un registro en mensajes (rol=asistente) con el path
 * correcto para que el panel lo muestre en la conversación.
 */
async function enviarMedioBiblioteca(
  sock: WASocket,
  jid: string,
  medio: MedioBiblioteca,
  cuentaId: string,
  conversacionId: string,
  prefijo: string,
): Promise<void> {
  // Para que el panel muestre el medio, guardamos el path con prefijo
  // "biblio:" como media_path. La burbuja del panel lo resuelve a
  // /api/biblioteca/<idCuenta>/<archivo>.
  const mediaPathPanel = `biblio:${medio.ruta_archivo}`;

  await insertarMensaje(cuentaId, conversacionId, "asistente", "", {
    tipo: medio.tipo,
    media_path: mediaPathPanel,
  });

  // Descargamos el contenido de Storage (con fallback local) y se lo
  // pasamos a Baileys como Buffer en vez de URL — más portable entre
  // instancias del bot.
  const descargado = await descargarBiblioteca(medio.ruta_archivo);
  if (!descargado) {
    console.error(
      `${prefijo} medio biblioteca ${medio.identificador} no existe en Storage ni local`,
    );
    return;
  }
  const { buffer } = descargado;

  let resultado: { key?: { id?: string | null } } | undefined;
  try {
    if (medio.tipo === "imagen") {
      resultado = await sock.sendMessage(jid, { image: buffer });
    } else if (medio.tipo === "video") {
      resultado = await sock.sendMessage(jid, { video: buffer });
    } else if (medio.tipo === "audio") {
      resultado = await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: "audio/mpeg",
        ptt: false,
      });
    } else if (medio.tipo === "documento") {
      resultado = await sock.sendMessage(jid, {
        document: buffer,
        fileName: medio.identificador,
        mimetype: "application/octet-stream",
      });
    }
    recordarEnvioBot(cuentaId, resultado?.key?.id);
    console.log(
      `${prefijo} → biblioteca:${medio.identificador} (${medio.tipo}) enviado`,
    );
  } catch (err) {
    console.error(
      `${prefijo} error enviando medio biblioteca ${medio.identificador}:`,
      err,
    );
  }
}

/**
 * Obtiene metadata necesaria para que WhatsApp acepte un audio como nota
 * de voz. Sin estos campos, las versiones nuevas de WhatsApp / Baileys 6.7.9+
 * muestran "este audio ya no está disponible" al recipiente.
 */
async function obtenerMetadataAudio(
  rutaArchivo: string,
): Promise<{ seconds: number; waveform: Uint8Array | undefined }> {
  let seconds = 1;
  let waveform: Uint8Array | undefined;
  try {
    const dur = await getAudioDuration(rutaArchivo);
    if (typeof dur === "number" && dur > 0) seconds = Math.round(dur);
  } catch (err) {
    console.warn("[audio] no se pudo obtener duración:", err);
  }
  try {
    waveform = await getAudioWaveform(rutaArchivo);
  } catch (err) {
    console.warn("[audio] no se pudo obtener waveform:", err);
  }
  return { seconds, waveform };
}

export function registrarManejadores(
  sock: WASocket,
  cuentaId: string,
  etiquetaCuenta: string,
): void {
  const prefijo = `[bot:${etiquetaCuenta}]`;

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // Aceptamos "notify" (mensajes en tiempo real) Y "append"
    // (mensajes que WhatsApp re-entrega tras reconectar).
    // Sin "append", el primer mensaje del cliente después de un
    // reconnect quedaba en limbo hasta que llegaba un segundo mensaje.
    // La idempotencia por wa_msg_id evita duplicados (ver insertarMensaje).
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      try {
        const clave = msg.key as ClaveMensajeExtendida;
        const remoteJid = clave.remoteJid;
        const desdeMi = !!clave.fromMe;

        // Log de debug al inicio absoluto: nos permite diagnosticar
        // si un mensaje llegó pero se descartó silenciosamente más
        // adelante (filtros, dedupe, error en parser, etc).
        console.log(
          `${prefijo} 📥 evento entrante type=${type} remoteJid=${remoteJid ?? "null"} fromMe=${desdeMi} msgId=${msg.key.id ?? "?"}`,
        );

        if (!remoteJid) continue;
        if (remoteJid.endsWith("@g.us")) continue;
        if (remoteJid.endsWith("@broadcast")) continue;
        if (remoteJid.endsWith("@newsletter")) continue;

        // Si el mensaje fromMe es eco de algo que enviamos nosotros
        // (bot IA o panel humano), ya está en DB. Skip para no duplicar.
        if (desdeMi && fueEnviadoPorNosotros(cuentaId, msg.key.id)) {
          continue;
        }

        const identidad = resolverIdentidad(clave);
        if (!identidad) continue;
        const { jidParaEnviar, telefonoMostrable } = identidad;
        if (!telefonoMostrable) continue;

        const cuenta = await obtenerCuenta(cuentaId);
        if (!cuenta) {
          console.warn(
            `${prefijo} ⚠ cuenta ${cuentaId} no existe en DB — mensaje ignorado`,
          );
          continue;
        }
        if (cuenta.esta_archivada) {
          console.warn(
            `${prefijo} ⚠ cuenta archivada — mensaje ignorado`,
          );
          continue;
        }

        // ---- Procesar contenido del mensaje ----
        // Primero intentar texto plano, después media (audio/imagen/etc)
        const textoPlano = extraerTexto(msg.message);
        let tipo: TipoMensaje = "texto";
        let contenido = "";
        let mediaPath: string | null = null;

        if (textoPlano) {
          contenido = textoPlano;
        } else {
          const procesado = await procesarMediaEntrante(
            sock,
            msg,
            cuentaId,
            prefijo,
          );
          if (!procesado) {
            // Log diagnóstico: el mensaje llegó pero no detectamos
            // ni texto ni tipo de media reconocido. Probablemente
            // un tipo nuevo (sticker, contact, location, etc).
            const claves = msg.message ? Object.keys(msg.message) : [];
            console.log(
              `${prefijo}   mensaje ignorado (no es texto ni media reconocido). claves=[${claves.join(",")}]`,
            );
            continue;
          }
          tipo = procesado.tipo;
          contenido = procesado.contenido;
          mediaPath = procesado.mediaPath;
        }

        if (!contenido && !mediaPath) continue;

        const conversacion = await obtenerOCrearConversacion(
          cuentaId,
          telefonoMostrable,
          msg.pushName ?? null,
          jidParaEnviar,
        );

        // Detectar si la conversación está vacía ANTES de insertar.
        // Si es la primera vez que vemos a este contacto en nuestra DB,
        // disparamos fetch on-demand del historial para que la IA tenga
        // contexto en sus próximas respuestas.
        const eraConversacionNueva =
          (await contarMensajesDeConversacion(conversacion.id)) === 0;

        const previewLog =
          tipo === "texto"
            ? `"${contenido.slice(0, 80)}"`
            : `[${tipo}] ${contenido.slice(0, 60)}`;
        console.log(
          `${prefijo} ← ${conversacion.nombre ?? telefonoMostrable} (+${telefonoMostrable}): ${previewLog}`,
        );

        // Si fue enviado desde el celular conectado manualmente
        // (fromMe=true pero no es eco de un envío nuestro), lo guardamos
        // como rol=humano para que aparezca en el panel y NO disparamos
        // la IA (ya respondió la persona).
        if (desdeMi) {
          await insertarMensaje(cuentaId, conversacion.id, "humano", contenido, {
            tipo,
            media_path: mediaPath,
            wa_msg_id: msg.key.id ?? null,
          });
          // Cancelar cualquier timer de buffer pendiente: ya respondió un humano
          cancelarTimer(conversacion.id);
          continue;
        }

        await insertarMensaje(cuentaId, conversacion.id, "usuario", contenido, {
          tipo,
          media_path: mediaPath,
          wa_msg_id: msg.key.id ?? null,
        });

        // Handoff inmediato por palabras clave configuradas en /configuracion.
        // Si el cliente escribe "hablar con humano", "agente humano", etc.,
        // disparamos handoff sin pasar por la IA y ya el operador atiende.
        if (cuenta.palabras_handoff?.trim() && contenido) {
          const palabras = cuenta.palabras_handoff
            .split(",")
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean);
          const textoLower = contenido.toLowerCase();
          const matched = palabras.find((p) => textoLower.includes(p));
          if (matched) {
            console.log(
              `${prefijo} 🤝 handoff por palabra clave "${matched}" — el cliente pidió humano`,
            );
            try {
              await marcarConversacionNecesitaHumano(
                conversacion.id,
                `Cliente pidió hablar con humano (palabra clave: "${matched}")`,
              );
              dispararWebhook(cuentaId, "handoff_humano", {
                conversacion_id: conversacion.id,
                telefono: telefonoMostrable,
                nombre: conversacion.nombre,
                razon: `palabra clave: ${matched}`,
              });
            } catch (err) {
              console.error(`${prefijo} error en handoff por palabra:`, err);
            }
            continue; // No pasamos a la IA
          }
        }

        // Webhooks: notificar que llegó mensaje + (si la conv es nueva)
        // que apareció contacto nuevo. Fire-and-forget — no bloquea.
        dispararWebhook(cuentaId, "mensaje_recibido", {
          conversacion_id: conversacion.id,
          telefono: telefonoMostrable,
          nombre: conversacion.nombre,
          tipo,
          contenido,
          media_path: mediaPath,
          wa_msg_id: msg.key.id ?? null,
        });
        if (eraConversacionNueva) {
          dispararWebhook(cuentaId, "contacto_nuevo", {
            conversacion_id: conversacion.id,
            telefono: telefonoMostrable,
            nombre: conversacion.nombre,
            primer_mensaje: contenido,
          });
        }

        // Conversación nueva → en background traemos los últimos 50
        // mensajes de WhatsApp de este contacto. Llegan vía
        // 'messaging-history.set' y se insertan como históricos
        // (sin disparar IA, con timestamp original).
        if (eraConversacionNueva && msg.key && msg.messageTimestamp) {
          dispararFetchHistorialContacto(
            sock,
            cuentaId,
            conversacion.id,
            msg,
            prefijo,
          );
        }

        // Extracción de emails: si el cliente tipeó un email en el mensaje
        // (texto, transcripción de audio, o caption de imagen), lo capturamos
        // en contactos_email para usar después en CRM/email marketing.
        try {
          const emails = extraerEmailsDelTexto(contenido);
          if (emails.length > 0) {
            const { nuevos, sospechosos } = await guardarContactosEmail(
              cuentaId,
              conversacion.id,
              emails,
            );
            if (nuevos > 0) {
              console.log(
                `${prefijo} 📧 ${nuevos} email(s) nuevos capturados: [${emails.join(", ")}]`,
              );
            }
            if (sospechosos.length > 0) {
              console.log(
                `${prefijo} ⚠ email(s) sospechoso(s) (revisar): [${sospechosos.join(", ")}]`,
              );
            }
          }
        } catch (err) {
          console.error(`${prefijo} error extrayendo emails:`, err);
        }

        // Extracción de teléfonos: capturamos números mencionados en
        // el mensaje (excluyendo el propio número del cliente).
        try {
          const tels = extraerTelefonosDelTexto(contenido);
          if (tels.length > 0) {
            const nuevos = await guardarContactosTelefono(
              cuentaId,
              conversacion.id,
              tels,
              telefonoMostrable,
            );
            if (nuevos > 0) {
              console.log(
                `${prefijo} 📱 ${nuevos} tel(s) nuevo(s) capturados: [${tels.join(", ")}]`,
              );
            }
          }
        } catch (err) {
          console.error(`${prefijo} error extrayendo teléfonos:`, err);
        }

        const fresca = await obtenerConversacionPorId(conversacion.id);
        if (!fresca) {
          console.warn(
            `${prefijo} ⚠ conversación ${conversacion.id} no existe — no respondo`,
          );
          cancelarTimer(conversacion.id);
          continue;
        }
        if (fresca.modo !== "IA") {
          console.log(
            `${prefijo} ⏸ conv en modo ${fresca.modo} (necesita_humano=${fresca.necesita_humano}) — no respondo. Cambialo a IA en el panel para que el bot retome.`,
          );
          cancelarTimer(conversacion.id);
          continue;
        }
        // Pre-check OpenAI antes de armar la respuesta
        if (!process.env.OPENAI_API_KEY) {
          console.error(
            `${prefijo} ✗ NO HAY OPENAI_API_KEY — el bot no puede generar respuesta. Agregala en .env.local y reiniciá.`,
          );
          continue;
        }
        console.log(
          `${prefijo} ✓ generando respuesta IA para ${conversacion.nombre ?? telefonoMostrable}...`,
        );

        // Buffering opcional
        if (cuenta.buffer_segundos > 0) {
          cancelarTimer(conversacion.id);
          const idConv = conversacion.id;
          const timer = setTimeout(async () => {
            timersBuffer.delete(idConv);
            const cuentaFresca = await obtenerCuenta(cuentaId);
            if (!cuentaFresca || cuentaFresca.esta_archivada) return;
            const convFresca = await obtenerConversacionPorId(idConv);
            if (!convFresca || convFresca.modo !== "IA") return;
            try {
              await generarYEnviarRespuesta(
                sock,
                cuentaFresca,
                convFresca,
                jidParaEnviar,
                prefijo,
              );
            } catch (err) {
              console.error(`${prefijo} error en respuesta diferida:`, err);
            }
          }, cuenta.buffer_segundos * 1000);
          timersBuffer.set(conversacion.id, timer);
          console.log(
            `${prefijo} buffer ${cuenta.buffer_segundos}s armado para ${conversacion.nombre ?? telefonoMostrable}`,
          );
          continue;
        }

        await generarYEnviarRespuesta(
          sock,
          cuenta,
          fresca,
          jidParaEnviar,
          prefijo,
        );
      } catch (err) {
        console.error(`${prefijo} error procesando mensaje entrante:`, err);
      }
    }
  });

  // ============================================================
  // Historial bajo demanda: 'messaging-history.set' llega como respuesta
  // a sock.fetchMessageHistory() (o al sync inicial si syncFullHistory=true).
  // Insertamos como históricos: sin disparar IA, con timestamp original,
  // upsert por wa_msg_id para idempotencia entre reconexiones.
  // ============================================================
  sock.ev.on("messaging-history.set", async ({ messages, progress, isLatest }) => {
    if (!messages || messages.length === 0) return;
    console.log(
      `${prefijo} 📜 historial recibido: ${messages.length} msgs (progress=${progress ?? "?"}, isLatest=${isLatest ?? "?"})`,
    );
    let insertados = 0;
    for (const m of messages) {
      try {
        await procesarMensajeHistorico(m, cuentaId, prefijo);
        insertados++;
      } catch (err) {
        console.error(`${prefijo} error procesando msg histórico:`, err);
      }
    }
    if (insertados > 0) {
      console.log(`${prefijo} 📜 ${insertados} msgs históricos guardados`);
    }
  });
}

// ============================================================
// Procesa UN mensaje histórico: lo asocia a su conversación
// (creándola si no existe) y lo inserta marcado como histórico.
// NUNCA dispara IA ni encola respuesta.
// ============================================================
async function procesarMensajeHistorico(
  m: WAMessage,
  cuentaId: string,
  prefijo: string,
): Promise<void> {
  const remoteJid = m.key?.remoteJid;
  if (!remoteJid || !m.key?.id) return;
  if (remoteJid.endsWith("@g.us")) return;
  if (remoteJid.endsWith("@broadcast")) return;
  if (remoteJid.endsWith("@newsletter")) return;

  // Timestamp original del mensaje (Long o number, en segundos).
  const tsRaw = m.messageTimestamp;
  if (!tsRaw) return;
  const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return;
  const creadoEn = new Date(tsNum * 1000).toISOString();

  // Identidad / teléfono
  const sinSufijo = remoteJid.split("@")[0] ?? "";
  const telefono = sinSufijo.split(":")[0] ?? "";
  if (!telefono) return;

  // Texto + tipo (sin descargar media — claves E2E suelen estar expiradas)
  const textoPlano = extraerTexto(m.message);
  const infoMedia = !textoPlano ? detectarTipoMedia(m) : null;
  let tipo: TipoMensaje = "texto";
  let contenido = "";
  if (textoPlano) {
    contenido = textoPlano;
  } else if (infoMedia) {
    tipo = infoMedia.tipo;
    contenido = infoMedia.caption?.trim() || `[${infoMedia.tipo} histórico]`;
  } else {
    return; // sin contenido reconocible
  }

  // Conversación (si no existe la creamos para que el panel la muestre)
  const conv = await obtenerOCrearConversacion(
    cuentaId,
    telefono,
    m.pushName ?? null,
    remoteJid,
  );

  const rol = m.key.fromMe ? "humano" : "usuario";
  await insertarMensaje(cuentaId, conv.id, rol, contenido, {
    tipo,
    media_path: null, // media histórica no la bajamos
    wa_msg_id: m.key.id,
    creado_en: creadoEn,
    es_historico: true,
  });
  // Sin extracción de emails/teléfonos para no spamear logs.
  void prefijo;
}

// ============================================================
// Dispara fetchMessageHistory para una conversación específica.
// Pide los 50 mensajes anteriores al que acabamos de recibir.
// La respuesta llega async vía 'messaging-history.set'.
// ============================================================
function dispararFetchHistorialContacto(
  sock: WASocket,
  cuentaId: string,
  conversacionId: string,
  msgPivote: WAMessage,
  prefijo: string,
): void {
  void cuentaId;
  void conversacionId;
  if (!msgPivote.key || !msgPivote.messageTimestamp) return;
  const ts = msgPivote.messageTimestamp;
  const tsNum = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(tsNum)) return;

  // Background — no bloqueamos el procesamiento del mensaje real.
  void (async () => {
    try {
      const reqId = await sock.fetchMessageHistory(50, msgPivote.key, ts);
      console.log(
        `${prefijo} 📜 pidiendo historial on-demand para nueva conv (req ${reqId})`,
      );
    } catch (err) {
      console.warn(`${prefijo} fetchMessageHistory falló (no es crítico):`, err);
    }
  })();
}

/**
 * Pide más historial de una conversación específica desde el mensaje
 * más viejo que tenemos. Llamado desde la API cuando el usuario clickea
 * "Cargar mensajes anteriores" en el panel.
 *
 * Devuelve el reqId de Baileys (los mensajes llegan async via
 * 'messaging-history.set' y se guardan vía procesarMensajeHistorico).
 */
export async function pedirMasHistorialConversacion(
  sock: WASocket,
  msgMasViejoKey: { id: string; remoteJid: string; fromMe: boolean },
  msgMasViejoTimestampIso: string,
  cantidad = 50,
): Promise<string> {
  const ts = Math.floor(new Date(msgMasViejoTimestampIso).getTime() / 1000);
  return await sock.fetchMessageHistory(
    Math.min(50, Math.max(1, cantidad)),
    msgMasViejoKey as WAMessage["key"],
    ts,
  );
}

// ============================================================
// Bandeja de salida — envía mensajes humanos / multimedia desde el panel
// ============================================================
async function enviarItemBandeja(
  sock: WASocket,
  jid: string,
  item: FilaBandejaSalida,
): Promise<void> {
  const tipo = item.tipo;
  let resultado: { key?: { id?: string | null } } | undefined;

  if (tipo === "texto" || tipo === "sistema") {
    resultado = await sock.sendMessage(jid, { text: item.contenido });
  } else if (!item.media_path) {
    // Falta la media: enviamos el contenido como texto fallback
    resultado = await sock.sendMessage(jid, {
      text: item.contenido || "[media no disponible]",
    });
  } else {
    const descargado = await descargarMediaChat(item.media_path);
    if (!descargado) {
      console.error(
        `[bandeja] media ${item.media_path} no encontrada en Storage ni local — enviando texto fallback`,
      );
      resultado = await sock.sendMessage(jid, {
        text: item.contenido || "[media no disponible]",
      });
    } else {
      const { buffer } = descargado;
      const nombreArchivo = item.media_path.split("/").pop() ?? "";
      const ext = nombreArchivo.split(".").pop()?.toLowerCase() ?? "";

      if (tipo === "imagen") {
        resultado = await sock.sendMessage(jid, {
          image: buffer,
          caption: item.contenido || undefined,
        });
      } else if (tipo === "video") {
        resultado = await sock.sendMessage(jid, {
          video: buffer,
          caption: item.contenido || undefined,
        });
      } else if (tipo === "audio") {
        let mimetype = "audio/ogg; codecs=opus";
        if (ext === "mp3" || ext === "mpeg") mimetype = "audio/mpeg";
        else if (ext === "m4a" || ext === "mp4") mimetype = "audio/mp4";
        else if (ext === "wav") mimetype = "audio/wav";

        // getAudioDuration / getAudioWaveform de Baileys necesitan path real.
        // Escribimos a temp, calculamos meta, borramos.
        const tmp = escribirTemporal(buffer, ext || "ogg");
        let meta: { seconds: number; waveform: Uint8Array | undefined };
        try {
          meta = await obtenerMetadataAudio(tmp);
        } finally {
          borrarTemporal(tmp);
        }
        const contenidoAudio = {
          audio: buffer,
          mimetype,
          ptt: true,
          seconds: meta.seconds,
          waveform: meta.waveform,
        } as unknown as Parameters<typeof sock.sendMessage>[1];
        resultado = await sock.sendMessage(jid, contenidoAudio);
      } else if (tipo === "documento") {
        resultado = await sock.sendMessage(jid, {
          document: buffer,
          fileName: item.contenido || nombreArchivo || "documento",
          mimetype: "application/octet-stream",
        });
      } else {
        resultado = await sock.sendMessage(jid, {
          text: item.contenido || "[mensaje]",
        });
      }
    }
  }

  recordarEnvioBot(item.cuenta_id, resultado?.key?.id);
}

export async function procesarBandejaSalidaDeCuenta(
  sock: WASocket,
  cuentaId: string,
  etiquetaCuenta: string,
): Promise<void> {
  const pendientes = await obtenerPendientesBandejaDeCuenta(cuentaId, 20);
  if (pendientes.length === 0) return;

  const prefijo = `[bot:${etiquetaCuenta}]`;
  for (const item of pendientes) {
    const conv = await obtenerConversacionPorId(item.conversacion_id);
    const jid = conv?.jid_wa ?? `${item.telefono}@s.whatsapp.net`;
    try {
      await enviarItemBandeja(sock, jid, item);
      await marcarBandejaEnviado(item.id);
      console.log(
        `${prefijo} → ${item.tipo} humano enviado a ${item.telefono}`,
      );
    } catch (err) {
      console.error(
        `${prefijo} falló envío de bandeja ${item.id} (reintentará):`,
        err,
      );
    }
  }
}
