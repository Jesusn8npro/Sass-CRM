/**
 * Catálogo de herramientas que el agente admin (Claude Haiku 4.5) puede
 * usar para responder al Patrón.
 *
 * Cada herramienta tiene:
 *   - name        — slug snake_case que el modelo invoca
 *   - description — qué hace y cuándo usarla (Claude lee esto para decidir)
 *   - input_schema — JSON Schema del input
 *   - ejecutar    — función JS que se ejecuta y devuelve string para el modelo
 *
 * Diseño: lecturas devuelven datos crudos/formateados, escrituras dejan
 * los resultados como borrador (publicación queda separada con confirmación).
 *
 * Reusa los handlers existentes:
 *   - reportes.ts          → métricas globales
 *   - comandosBlog.ts      → generar/publicar artículos
 *   - baseDatos/blog       → listar borradores
 *   - baseDatos/cuentas    → buscar cliente por nombre
 */
import {
  listarTodosLosArticulos,
  obtenerArticuloPorId,
  listarCuentasDeUsuarioAdmin,
} from "@/lib/baseDatos";
import { obtenerMetricasGlobales, listarCuentasCaidas } from "./reportes";
import {
  formatearReporteDiario,
  formatearAlertas,
} from "./reportesFormato";
import {
  ejecutarPostBlog,
  ejecutarPublicar,
} from "./comandosBlog";
import { db } from "@/lib/db/cliente";
import type { HerramientaAdmin } from "@/lib/anthropic";

/**
 * Construye el catálogo de tools. Recibe contexto del super-admin que
 * está conversando, para pasarlo a las herramientas que lo necesitan.
 */
export function construirHerramientasAdmin(contexto: {
  superAdminEmail: string;
  superAdminNombre: string | null;
}): HerramientaAdmin[] {
  return [
    {
      name: "obtener_reporte_global",
      description:
        "Devuelve el reporte completo del SaaS (usuarios totales, cuentas conectadas, ingresos del mes, mensajes 24h, alertas). Usalo cuando el Patrón pregunta cómo va todo, qué pasa hoy, resumen general, métricas, estadísticas, o status.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      ejecutar: async () => {
        const m = await obtenerMetricasGlobales();
        return formatearReporteDiario(m);
      },
    },
    {
      name: "listar_cuentas_caidas",
      description:
        "Lista las cuentas WhatsApp del SaaS que están caídas o con problemas de conexión (heartbeat > 30 min). Usalo cuando el Patrón pregunta por alertas, fallas, cuentas caídas, qué números no responden, problemas técnicos.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      ejecutar: async () => {
        const caidas = await listarCuentasCaidas();
        return formatearAlertas(caidas);
      },
    },
    {
      name: "buscar_cliente_por_nombre",
      description:
        "Busca un cliente del SaaS por nombre, email o id parcial. Devuelve sus cuentas y métricas básicas. Usalo cuando el Patrón menciona el nombre de un cliente específico y quiere info de ese cliente (cuántos mensajes tuvo, qué cuentas tiene, estado).",
      input_schema: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description:
              "Texto a buscar — puede ser nombre, parte del email, o id parcial.",
          },
        },
        required: ["consulta"],
      },
      ejecutar: async (input) => {
        const consulta = String(input.consulta ?? "").trim();
        if (consulta.length < 2)
          return "Consulta muy corta (mínimo 2 caracteres).";
        const { data, error } = await db()
          .from("usuarios")
          .select("id, email, nombre, creado_en")
          .or(
            `email.ilike.%${consulta}%,nombre.ilike.%${consulta}%,id.ilike.%${consulta}%`,
          )
          .limit(5);
        if (error) return `Error en búsqueda: ${error.message}`;
        if (!data || data.length === 0)
          return `No encontré clientes que matcheen "${consulta}".`;
        const lineas: string[] = [];
        for (const u of data) {
          const cuentas = await listarCuentasDeUsuarioAdmin(u.id);
          lineas.push(
            `· ${u.nombre ?? "(sin nombre)"} <${u.email}> — ${cuentas.length} cuenta${cuentas.length === 1 ? "" : "s"} WA. Id: ${u.id.slice(0, 8)}`,
          );
        }
        return lineas.join("\n");
      },
    },
    {
      name: "generar_articulo_blog",
      description:
        "Genera un artículo de blog completo con IA (texto + portada + imágenes inline según modo) y lo deja como BORRADOR. NO publica automáticamente — el Patrón debe confirmar después con publicar_articulo_blog. Tarda 60-120 segundos. Usalo cuando el Patrón pide crear un artículo, escribir un post, generar contenido.",
      input_schema: {
        type: "object",
        properties: {
          tema: {
            type: "string",
            description:
              "Tema completo del artículo. Cuanto más específico mejor. Ej: 'Cómo usar WhatsApp Business + IA para vender más en 2026 en una pyme de Colombia'.",
          },
          modo_imagenes: {
            type: "string",
            enum: ["auto", "solo-portada", "completo", "sin-imagenes"],
            description:
              "auto = portada + inlines según largo (default). solo-portada = barato. completo = portada + 2 inlines garantizadas. sin-imagenes = solo texto.",
          },
        },
        required: ["tema"],
      },
      ejecutar: async (input) => {
        const tema = String(input.tema ?? "").trim();
        const modo = (
          ["auto", "solo-portada", "completo", "sin-imagenes"].includes(
            input.modo_imagenes as string,
          )
            ? input.modo_imagenes
            : "auto"
        ) as "auto" | "solo-portada" | "completo" | "sin-imagenes";
        if (tema.length < 5) return "El tema es muy corto, mínimo 5 chars.";
        const r = await ejecutarPostBlog(
          tema,
          contexto.superAdminEmail,
          contexto.superAdminNombre,
          modo,
        );
        return r.respuesta;
      },
    },
    {
      name: "listar_borradores_blog",
      description:
        "Lista los últimos 10 borradores de artículos pendientes de publicar. Usalo cuando el Patrón pregunta qué borradores tiene, qué falta publicar, qué artículos están pendientes.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      ejecutar: async () => {
        const borradores = await listarTodosLosArticulos({
          estado: "borrador",
          limite: 10,
        });
        if (borradores.length === 0) return "No hay borradores pendientes.";
        const lineas: string[] = [`Borradores (${borradores.length}):`];
        for (const a of borradores) {
          lineas.push(
            `· "${a.titulo}" — id corto: ${a.id.slice(0, 8)} — ${a.tiempo_lectura_min} min lectura`,
          );
        }
        return lineas.join("\n");
      },
    },
    {
      name: "publicar_articulo_blog",
      description:
        "Publica un artículo que ya está como borrador. ACCIÓN DESTRUCTIVA — antes de invocar esta herramienta, debés confirmar con el Patrón ('Confirmás que publique X?') y solo ejecutar si él responde explícitamente que sí. Acepta el id completo o el prefijo de 8 chars que devuelve listar_borradores_blog.",
      input_schema: {
        type: "object",
        properties: {
          id_articulo: {
            type: "string",
            description:
              "Id completo o prefijo de 8 chars del artículo a publicar.",
          },
        },
        required: ["id_articulo"],
      },
      ejecutar: async (input) => {
        const id = String(input.id_articulo ?? "").trim();
        if (!id) return "Falta el id del artículo.";
        const r = await ejecutarPublicar(id);
        return r.respuesta;
      },
    },
    {
      name: "obtener_detalle_articulo",
      description:
        "Devuelve detalle completo de un artículo (publicado o borrador) por su id corto. Usalo si el Patrón pide ver un artículo específico antes de publicarlo o si pregunta detalles de uno.",
      input_schema: {
        type: "object",
        properties: {
          id_articulo: {
            type: "string",
            description: "Id completo o prefijo de 8 chars.",
          },
        },
        required: ["id_articulo"],
      },
      ejecutar: async (input) => {
        const id = String(input.id_articulo ?? "").trim();
        if (!id) return "Falta el id.";
        // Intentar como id completo
        let articulo = await obtenerArticuloPorId(id);
        // Si no, buscar por prefijo
        if (!articulo && id.length === 8) {
          const todos = await listarTodosLosArticulos({ limite: 50 });
          const match = todos.find((a) => a.id.startsWith(id));
          if (match) articulo = await obtenerArticuloPorId(match.id);
        }
        if (!articulo) return `No encontré artículo con id "${id}".`;
        return [
          `Título: ${articulo.titulo}`,
          `Estado: ${articulo.estado}`,
          `Slug: /blog/${articulo.slug}`,
          `Resumen: ${articulo.resumen}`,
          `Keywords: ${articulo.seo_keywords.join(", ")}`,
          `Lectura: ${articulo.tiempo_lectura_min} min`,
          `Portada: ${articulo.imagen_portada_url ? "sí" : "no"}`,
        ].join("\n");
      },
    },
  ];
}
