/**
 * Acciones que la IA puede activar via tools en su respuesta:
 * registrar interés, handoff humano, iniciar/agendar llamada,
 * programar seguimiento, agendar/reprogramar/cancelar cita.
 *
 * Se llaman secuencialmente desde generarYEnviarRespuesta tras enviar
 * las partes de texto/audio/media al cliente.
 */
import {
  actualizarCita,
  crearCita,
  crearLlamadaProgramada,
  crearSeguimiento,
  insertarMensaje,
  marcarConversacionNecesitaHumano,
  obtenerCita,
  obtenerProducto,
  registrarInteresEnProducto,
  type Cita,
  type Conversacion,
  type Cuenta,
} from "../baseDatos";
import { iniciarLlamadaConContexto } from "../llamadas";
import { type RespuestaIA } from "../openai";
import { dispararWebhook } from "../webhooks";
import { parseFechaIso } from "./manejadorEnvio";

// Helper: la IA a veces manda una FECHA en cita_id en vez del UUID.
// Si lo detectamos, intentamos resolver mirando las citas activas y
// matcheando por fecha. Como último recurso usamos la única cita activa.
const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolverCitaId(
  idCandidato: string,
  citasActivas: Cita[],
  prefijo: string,
): Promise<string | null> {
  const v = idCandidato?.trim() ?? "";
  if (RE_UUID.test(v)) return v;
  if (citasActivas.length === 0) return null;
  if (citasActivas.length === 1) {
    console.log(
      `${prefijo} 🔧 cita_id no era UUID ("${v}"), usando única cita activa: ${citasActivas[0]!.id}`,
    );
    return citasActivas[0]!.id;
  }
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

export async function procesarAccionesIA(
  respuesta: RespuestaIA,
  cuenta: Cuenta,
  conversacion: Conversacion,
  citasActivas: Cita[],
  prefijo: string,
): Promise<void> {
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
  // Reprogramar cita
  // ============================================================

  if (respuesta.reprogramar_cita?.activar) {
    const rc = respuesta.reprogramar_cita;
    const fecha = parseFechaIso(rc.nueva_fecha_iso);
    const citaIdResuelto = await resolverCitaId(rc.cita_id, citasActivas, prefijo);
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
    const citaIdCancelar = await resolverCitaId(cc.cita_id, citasActivas, prefijo);
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
