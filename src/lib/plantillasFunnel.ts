/**
 * Plantillas pre-armadas de funnel de ventas.
 *
 * Cada plantilla es un array de pasos con paso_id, nombre, criterio
 * de transición, objetivos a cumplir y descripción. Cuando el dueño
 * elige una plantilla desde /funnel, creamos N etapas de una sola vez
 * y la IA empieza a usarlas (cada conversación tiene `paso_actual` que
 * la IA actualiza con `cambiar_estado` o `cambiar_paso`).
 */

import { crearEtapa, listarEtapas, type EtapaPipeline } from "./baseDatos";

export interface PasoPlantilla {
  paso_id: string;
  nombre: string;
  color: string;
  paso_siguiente_id: string | null;
  criterio_transicion: string;
  objetivos: string; // CSV
  descripcion: string;
}

export interface PlantillaFunnel {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  pasos: PasoPlantilla[];
}

export const PLANTILLAS_FUNNEL: PlantillaFunnel[] = [
  // ============================================================
  // INMOBILIARIA
  // ============================================================
  {
    id: "inmobiliaria",
    nombre: "Inmobiliaria / Bienes Raíces",
    descripcion: "Funnel para captación de leads interesados en compra, venta o alquiler de propiedades.",
    icono: "🏠",
    pasos: [
      {
        paso_id: "bienvenida",
        nombre: "Bienvenida",
        color: "zinc",
        paso_siguiente_id: "calificacion",
        criterio_transicion:
          "Avanzar cuando el cliente haga su primera consulta o salude. El objetivo es identificar si busca comprar, vender o alquilar.",
        objetivos: "saludo_hecho,intencion_identificada",
        descripcion:
          "Primer contacto, dar la bienvenida y detectar el tipo de operación (compra/venta/alquiler).",
      },
      {
        paso_id: "calificacion",
        nombre: "Calificación",
        color: "azul",
        paso_siguiente_id: "presentacion_opciones",
        criterio_transicion:
          "Avanzar cuando tengamos: zona de interés + presupuesto aproximado + nombre y contacto del cliente.",
        objetivos: "nombre_capturado,contacto_capturado,zona_definida,presupuesto_definido",
        descripcion:
          "Obtener información sobre presupuesto, zona, tipo de propiedad y datos de contacto.",
      },
      {
        paso_id: "presentacion_opciones",
        nombre: "Presentación de Opciones",
        color: "violeta",
        paso_siguiente_id: "agendar_visita",
        criterio_transicion:
          "Avanzar cuando el cliente muestre interés en una o más propiedades específicas.",
        objetivos: "opciones_presentadas,interes_detectado",
        descripcion:
          "Presentar opciones disponibles que coincidan con los criterios del cliente.",
      },
      {
        paso_id: "agendar_visita",
        nombre: "Agendar Visita",
        color: "ambar",
        paso_siguiente_id: "negociacion",
        criterio_transicion:
          "Avanzar cuando el cliente confirme fecha y hora para visitar la propiedad.",
        objetivos: "visita_agendada",
        descripcion:
          "Coordinar visita presencial o virtual a la propiedad de interés.",
      },
      {
        paso_id: "negociacion",
        nombre: "Negociación",
        color: "rosa",
        paso_siguiente_id: "cierre",
        criterio_transicion:
          "Avanzar cuando el cliente haga una oferta o muestre intención de cerrar.",
        objetivos: "oferta_recibida",
        descripcion:
          "Negociar precio, condiciones y términos del contrato.",
      },
      {
        paso_id: "cierre",
        nombre: "Cierre",
        color: "esmeralda",
        paso_siguiente_id: null,
        criterio_transicion: "Fin del flujo: contrato firmado.",
        objetivos: "contrato_firmado",
        descripcion:
          "Confirmación final, firma de contrato y siguiente pasos administrativos.",
      },
    ],
  },

  // ============================================================
  // ECOMMERCE
  // ============================================================
  {
    id: "ecommerce",
    nombre: "E-commerce / Tienda Online",
    descripcion: "Funnel para atención al cliente de tienda online: consultas, ventas y postventa.",
    icono: "🛒",
    pasos: [
      {
        paso_id: "bienvenida",
        nombre: "Bienvenida",
        color: "zinc",
        paso_siguiente_id: "consulta_producto",
        criterio_transicion:
          "Avanzar cuando el cliente pregunte por un producto, categoría o tema específico.",
        objetivos: "saludo_hecho,intencion_identificada",
        descripcion:
          "Recibir al cliente y detectar si quiere consultar producto, hacer pedido o resolver problema.",
      },
      {
        paso_id: "consulta_producto",
        nombre: "Consulta de Producto",
        color: "azul",
        paso_siguiente_id: "agregar_carrito",
        criterio_transicion:
          "Avanzar cuando el cliente muestre interés concreto en un producto (precio, foto, stock).",
        objetivos: "producto_identificado,interes_detectado",
        descripcion:
          "Mostrar info, foto y stock del producto. Si no tenemos stock, ofrecer alternativas.",
      },
      {
        paso_id: "agregar_carrito",
        nombre: "Agregar al carrito",
        color: "violeta",
        paso_siguiente_id: "datos_envio",
        criterio_transicion:
          "Avanzar cuando el cliente confirme que quiere comprar el producto.",
        objetivos: "intencion_compra_confirmada",
        descripcion:
          "Confirmar cantidad, color/talle, y agregar al pedido.",
      },
      {
        paso_id: "datos_envio",
        nombre: "Datos de Envío",
        color: "ambar",
        paso_siguiente_id: "pago",
        criterio_transicion:
          "Avanzar cuando tengamos: nombre + dirección completa + ciudad + teléfono.",
        objetivos: "nombre_capturado,direccion_capturada,telefono_capturado",
        descripcion:
          "Obtener dirección de envío, teléfono y datos de facturación.",
      },
      {
        paso_id: "pago",
        nombre: "Pago",
        color: "rosa",
        paso_siguiente_id: "postventa",
        criterio_transicion:
          "Avanzar cuando el cliente envíe comprobante de pago o confirme método de pago contra entrega.",
        objetivos: "pago_confirmado",
        descripcion:
          "Coordinar método de pago: transferencia, tarjeta, contra entrega.",
      },
      {
        paso_id: "postventa",
        nombre: "Postventa",
        color: "esmeralda",
        paso_siguiente_id: null,
        criterio_transicion: "Fin del flujo: producto entregado y cliente satisfecho.",
        objetivos: "producto_entregado,cliente_satisfecho",
        descripcion:
          "Tracking del envío, confirmación de entrega y seguimiento de satisfacción.",
      },
    ],
  },

  // ============================================================
  // SERVICIOS PROFESIONALES
  // ============================================================
  {
    id: "servicios_profesionales",
    nombre: "Servicios Profesionales",
    descripcion: "Funnel para captación de clientes de servicios (consultoría, agencia, abogacía, etc.).",
    icono: "💼",
    pasos: [
      {
        paso_id: "bienvenida",
        nombre: "Bienvenida y Calificación Rápida",
        color: "zinc",
        paso_siguiente_id: "diagnostico",
        criterio_transicion:
          "Avanzar cuando el cliente mencione el tipo de servicio que busca o el problema que tiene.",
        objetivos: "saludo_hecho,intencion_identificada,industria_identificada",
        descripcion:
          "Primer contacto, detectar el tipo de servicio buscado y la industria del cliente.",
      },
      {
        paso_id: "diagnostico",
        nombre: "Diagnóstico",
        color: "azul",
        paso_siguiente_id: "presentacion_solucion",
        criterio_transicion:
          "Avanzar cuando entiendas: el problema principal, la urgencia, y el contexto del cliente.",
        objetivos: "problema_identificado,urgencia_detectada,contexto_capturado",
        descripcion:
          "Hacer preguntas para entender el problema real y el contexto.",
      },
      {
        paso_id: "presentacion_solucion",
        nombre: "Presentación de Solución",
        color: "violeta",
        paso_siguiente_id: "agendar_demo",
        criterio_transicion:
          "Avanzar cuando el cliente muestre interés directo en la solución propuesta.",
        objetivos: "solucion_presentada,interes_detectado",
        descripcion:
          "Presentar cómo resolvés ese problema específico, casos de éxito.",
      },
      {
        paso_id: "agendar_demo",
        nombre: "Agendar Demo / Reunión",
        color: "ambar",
        paso_siguiente_id: "propuesta",
        criterio_transicion:
          "Avanzar SOLAMENTE cuando la cita esté agendada exitosamente con fecha y hora confirmadas.",
        objetivos: "demo_agendada,fecha_confirmada",
        descripcion:
          "Coordinar reunión, demo o llamada con el equipo. Confirmar fecha, hora y modalidad.",
      },
      {
        paso_id: "propuesta",
        nombre: "Propuesta y Negociación",
        color: "rosa",
        paso_siguiente_id: "confirmacion",
        criterio_transicion:
          "Avanzar cuando el cliente confirme que quiere contratar y discutamos términos finales.",
        objetivos: "propuesta_enviada,terminos_acordados",
        descripcion:
          "Enviar propuesta formal, ajustar alcance y precio.",
      },
      {
        paso_id: "confirmacion",
        nombre: "Confirmación y Próximos Pasos",
        color: "esmeralda",
        paso_siguiente_id: null,
        criterio_transicion: "Fin del flujo: contrato firmado y onboarding iniciado.",
        objetivos: "contrato_firmado,onboarding_iniciado",
        descripcion:
          "Cierre formal, firma de contrato y arranque del proyecto.",
      },
    ],
  },

  // ============================================================
  // EDUCACIÓN
  // ============================================================
  {
    id: "educacion",
    nombre: "Educación / Cursos",
    descripcion: "Funnel para inscripción a cursos, talleres y programas educativos.",
    icono: "📚",
    pasos: [
      {
        paso_id: "bienvenida",
        nombre: "Bienvenida",
        color: "zinc",
        paso_siguiente_id: "info_curso",
        criterio_transicion:
          "Avanzar cuando el cliente pregunte por un curso específico o por la oferta general.",
        objetivos: "saludo_hecho,interes_detectado",
        descripcion:
          "Recibir al interesado y detectar qué curso o programa busca.",
      },
      {
        paso_id: "info_curso",
        nombre: "Información del Curso",
        color: "azul",
        paso_siguiente_id: "calificar_perfil",
        criterio_transicion:
          "Avanzar cuando el cliente haya recibido la info y muestre interés en seguir.",
        objetivos: "info_enviada,curso_identificado",
        descripcion:
          "Compartir programa, duración, modalidad, certificación y precio.",
      },
      {
        paso_id: "calificar_perfil",
        nombre: "Calificación del Perfil",
        color: "violeta",
        paso_siguiente_id: "presentar_opciones",
        criterio_transicion:
          "Avanzar cuando tengamos: nombre + nivel previo + objetivo del curso + disponibilidad horaria.",
        objetivos: "nombre_capturado,nivel_capturado,objetivo_capturado",
        descripcion:
          "Conocer experiencia previa, objetivo, disponibilidad y por qué quiere aprender esto.",
      },
      {
        paso_id: "presentar_opciones",
        nombre: "Presentar Plan de Pago",
        color: "ambar",
        paso_siguiente_id: "inscripcion",
        criterio_transicion:
          "Avanzar cuando el cliente elija una modalidad de pago (cuotas, contado, beca).",
        objetivos: "plan_pago_elegido",
        descripcion:
          "Mostrar las opciones de pago disponibles y promociones vigentes.",
      },
      {
        paso_id: "inscripcion",
        nombre: "Inscripción",
        color: "rosa",
        paso_siguiente_id: "onboarding",
        criterio_transicion:
          "Avanzar cuando el cliente envíe pago o confirme inscripción formal.",
        objetivos: "pago_confirmado,inscripcion_completa",
        descripcion:
          "Procesar inscripción, recibir pago y enviar acceso al curso.",
      },
      {
        paso_id: "onboarding",
        nombre: "Onboarding",
        color: "esmeralda",
        paso_siguiente_id: null,
        criterio_transicion:
          "Fin del flujo: alumno con acceso a la plataforma y sabiendo cuándo arranca.",
        objetivos: "acceso_enviado,fecha_inicio_comunicada",
        descripcion:
          "Dar la bienvenida formal, enviar credenciales de acceso y comunicar la fecha de inicio.",
      },
    ],
  },
];

/** Aplica una plantilla a una cuenta — crea las N etapas de una vez.
 * Si la cuenta ya tiene etapas, las deja: solo agrega las nuevas con
 * orden incremental. Para empezar limpio, el dueño debería borrar
 * las etapas viejas antes desde la UI. */
export async function aplicarPlantillaFunnel(
  cuentaId: string,
  plantillaId: string,
): Promise<EtapaPipeline[]> {
  const plantilla = PLANTILLAS_FUNNEL.find((p) => p.id === plantillaId);
  if (!plantilla) {
    throw new Error(`Plantilla "${plantillaId}" no existe`);
  }

  // Verificamos qué paso_ids ya existen para no duplicar
  const existentes = await listarEtapas(cuentaId);
  const idsExistentes = new Set(
    existentes.map((e) => e.paso_id).filter((p): p is string => !!p),
  );

  const creadas: EtapaPipeline[] = [];
  for (const paso of plantilla.pasos) {
    if (idsExistentes.has(paso.paso_id)) continue;
    const etapa = await crearEtapa(cuentaId, paso.nombre, paso.color, {
      paso_id: paso.paso_id,
      paso_siguiente_id: paso.paso_siguiente_id,
      criterio_transicion: paso.criterio_transicion,
      objetivos: paso.objetivos,
      descripcion: paso.descripcion,
    });
    creadas.push(etapa);
  }
  return await listarEtapas(cuentaId);
}
