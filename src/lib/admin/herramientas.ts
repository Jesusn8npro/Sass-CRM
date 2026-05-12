/**
 * Catálogo de herramientas que el agente admin (Claude Haiku 4.5) puede
 * usar para responder al Patrón.
 *
 * DISEÑO CRÍTICO: las tools devuelven JSON CRUDO o texto plano SIN
 * formato WhatsApp (`*negrita*`, viñetas `·`). Razón: si la tool
 * devuelve texto pre-formateado, Claude lo copia literalmente y suena
 * robótico. Con JSON crudo, Claude reformula con su personalidad.
 *
 * Reusa los handlers existentes:
 *   - reportes.ts          → métricas globales
 *   - comandosBlog.ts      → generar/publicar artículos
 *   - baseDatos/blog       → listar borradores
 *   - baseDatos/cuentas    → listar/buscar cuentas
 *   - baseDatos/usuarios   → listar clientes
 */
import {
  listarTodosLosArticulos,
  obtenerArticuloPorId,
  listarCuentasDeUsuarioAdmin,
} from "@/lib/baseDatos";
import { obtenerMetricasGlobales, listarCuentasCaidas } from "./reportes";
import {
  ejecutarPostBlog,
  ejecutarPublicar,
} from "./comandosBlog";
import { db } from "@/lib/db/cliente";
import type { HerramientaAdmin } from "@/lib/anthropic";

/**
 * Devuelve un string JSON minificado de cualquier objeto. Lo usamos
 * como payload de tools para que Claude tenga datos crudos y los
 * verbalice con su propia personalidad.
 */
function asJson(data: unknown): string {
  return JSON.stringify(data);
}

export function construirHerramientasAdmin(contexto: {
  superAdminEmail: string;
  superAdminNombre: string | null;
}): HerramientaAdmin[] {
  return [
    // ============================================================
    // MÉTRICAS Y REPORTES
    // ============================================================
    {
      name: "obtener_reporte_global",
      description:
        "Devuelve métricas globales del SaaS como JSON (usuarios totales, cuentas WA conectadas/caídas, mensajes 24h, conversaciones activas, ingresos del mes, citas, leads). NO formatees la respuesta como lista con viñetas — relatá los números en prosa natural y conversacional como si se los contaras a un amigo. Usalo cuando el Patrón pregunta cómo va todo, qué pasa hoy, resumen general, métricas.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      ejecutar: async () => asJson(await obtenerMetricasGlobales()),
    },
    {
      name: "listar_cuentas_caidas",
      description:
        "Lista cuentas WhatsApp con heartbeat caído (>30 min sin conectarse). Devuelve JSON array. Si está vacío, decile al Patrón en prosa natural que todo está bien. Si hay caídas, comentale cuáles y desde cuándo en frase natural.",
      input_schema: {
        type: "object",
        properties: {},
        required: [],
      },
      ejecutar: async () => asJson(await listarCuentasCaidas()),
    },

    // ============================================================
    // CLIENTES / USUARIOS DEL SAAS
    // ============================================================
    {
      name: "listar_clientes",
      description:
        "Lista TODOS los clientes (usuarios) registrados en el SaaS, hasta 50. Devuelve JSON con nombre, email, plan, fecha de registro y cuántas cuentas WA tiene cada uno. Usá esta tool cuando el Patrón pregunta 'cuáles son nuestros clientes', 'mostrame los usuarios', 'lista de clientes', 'quiénes están registrados', etc. NO requiere ningún filtro.",
      input_schema: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Máximo de clientes a devolver (default 50, máx 100).",
          },
        },
        required: [],
      },
      ejecutar: async (input) => {
        const limite = Math.min(
          100,
          Math.max(1, Number(input.limite) || 50),
        );
        const { data: usuarios, error } = await db()
          .from("usuarios")
          .select("id, email, nombre, plan, creado_en")
          .order("creado_en", { ascending: false })
          .limit(limite);
        if (error) return asJson({ error: error.message });
        if (!usuarios || usuarios.length === 0)
          return asJson({ clientes: [], total: 0 });

        // Adjuntar cantidad de cuentas WA por usuario (en paralelo)
        const conCuentas = await Promise.all(
          usuarios.map(async (u) => {
            const cuentas = await listarCuentasDeUsuarioAdmin(u.id as string);
            return {
              id_corto: (u.id as string).slice(0, 8),
              nombre: u.nombre ?? null,
              email: u.email,
              plan: u.plan ?? "free",
              registrado_en: u.creado_en,
              cantidad_cuentas_wa: cuentas.length,
            };
          }),
        );
        return asJson({ clientes: conCuentas, total: conCuentas.length });
      },
    },
    {
      name: "buscar_cliente",
      description:
        "Busca clientes filtrando por nombre, email o id parcial. Devuelve hasta 5 matches en JSON. Usalo cuando el Patrón menciona el nombre/email específico de un cliente.",
      input_schema: {
        type: "object",
        properties: {
          consulta: {
            type: "string",
            description: "Texto a buscar: nombre, email o id parcial.",
          },
        },
        required: ["consulta"],
      },
      ejecutar: async (input) => {
        const consulta = String(input.consulta ?? "").trim();
        if (consulta.length < 2)
          return asJson({ error: "consulta muy corta" });
        const { data, error } = await db()
          .from("usuarios")
          .select("id, email, nombre, plan, creado_en")
          .or(
            `email.ilike.%${consulta}%,nombre.ilike.%${consulta}%,id.ilike.%${consulta}%`,
          )
          .limit(5);
        if (error) return asJson({ error: error.message });
        if (!data || data.length === 0)
          return asJson({ matches: [], consulta });

        const matches = await Promise.all(
          data.map(async (u) => {
            const cuentas = await listarCuentasDeUsuarioAdmin(u.id as string);
            return {
              id_corto: (u.id as string).slice(0, 8),
              nombre: u.nombre ?? null,
              email: u.email,
              plan: u.plan ?? "free",
              cuentas_wa: cuentas.length,
              etiquetas_cuentas: cuentas.map((c) => c.etiqueta),
            };
          }),
        );
        return asJson({ matches, consulta });
      },
    },
    {
      name: "obtener_detalle_cliente",
      description:
        "Devuelve detalle completo de un cliente específico por id corto: sus cuentas WA con estado, cantidad de mensajes intercambiados en 7 días, leads capturados, pagos realizados. Usalo cuando el Patrón ya identificó al cliente y quiere profundizar.",
      input_schema: {
        type: "object",
        properties: {
          id_cliente: {
            type: "string",
            description: "Id completo o prefijo de 8 chars del cliente.",
          },
        },
        required: ["id_cliente"],
      },
      ejecutar: async (input) => {
        const idInput = String(input.id_cliente ?? "").trim();
        if (!idInput) return asJson({ error: "falta id_cliente" });

        let usuarioId = idInput;
        if (idInput.length === 8) {
          const { data: match } = await db()
            .from("usuarios")
            .select("id")
            .ilike("id", `${idInput}%`)
            .limit(1)
            .maybeSingle();
          if (match) usuarioId = match.id as string;
        }

        const { data: usuario } = await db()
          .from("usuarios")
          .select("id, email, nombre, plan, creado_en, cuentas_extra_admin")
          .eq("id", usuarioId)
          .maybeSingle();
        if (!usuario) return asJson({ error: "cliente no encontrado" });

        const cuentas = await listarCuentasDeUsuarioAdmin(usuario.id as string);
        const cuentasResumen = cuentas.map((c) => ({
          id_corto: c.id.slice(0, 8),
          etiqueta: c.etiqueta,
          telefono: c.telefono,
          estado_conexion: c.estado,
          activa: c.esta_activa,
        }));

        return asJson({
          cliente: {
            id_corto: (usuario.id as string).slice(0, 8),
            nombre: usuario.nombre ?? null,
            email: usuario.email,
            plan: usuario.plan ?? "free",
            registrado_en: usuario.creado_en,
            cuentas_extra_admin: usuario.cuentas_extra_admin ?? 0,
          },
          cuentas: cuentasResumen,
        });
      },
    },

    // ============================================================
    // CUENTAS WHATSAPP DEL SAAS
    // ============================================================
    {
      name: "listar_cuentas_whatsapp_globales",
      description:
        "Lista TODAS las cuentas WhatsApp del SaaS (de todos los clientes), con etiqueta, teléfono, estado de conexión y dueño. Usalo cuando el Patrón pregunta 'cuáles son los números conectados', 'estado de las cuentas WA', 'qué cuentas tenemos'.",
      input_schema: {
        type: "object",
        properties: {
          solo_activas: {
            type: "boolean",
            description:
              "Si true, excluye cuentas archivadas. Default true.",
          },
        },
        required: [],
      },
      ejecutar: async (input) => {
        const soloActivas = input.solo_activas !== false;
        let q = db()
          .from("cuentas")
          .select("id, etiqueta, telefono, estado, esta_activa, usuario_id")
          .order("creada_en", { ascending: false })
          .limit(50);
        if (soloActivas) q = q.eq("esta_archivada", false);
        const { data, error } = await q;
        if (error) return asJson({ error: error.message });

        const usuariosIds = [
          ...new Set((data ?? []).map((c) => c.usuario_id as string)),
        ];
        const { data: usuarios } = await db()
          .from("usuarios")
          .select("id, email")
          .in("id", usuariosIds);
        const mapaEmail = new Map(
          (usuarios ?? []).map((u) => [u.id as string, u.email as string]),
        );

        return asJson({
          cuentas: (data ?? []).map((c) => ({
            id_corto: (c.id as string).slice(0, 8),
            etiqueta: c.etiqueta,
            telefono: c.telefono,
            estado_conexion: c.estado,
            activa: c.esta_activa,
            dueno_email: mapaEmail.get(c.usuario_id as string) ?? "(?)",
          })),
          total: (data ?? []).length,
        });
      },
    },

    // ============================================================
    // PAGOS E INGRESOS
    // ============================================================
    {
      name: "listar_pagos_recientes",
      description:
        "Lista los últimos pagos exitosos al SaaS (PayPal). Devuelve JSON con monto, plan, cliente, fecha. Usalo cuando el Patrón pregunta por ingresos, ventas recientes, quién pagó, etc.",
      input_schema: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Máximo de pagos a devolver (default 10, máx 30).",
          },
        },
        required: [],
      },
      ejecutar: async (input) => {
        const limite = Math.min(
          30,
          Math.max(1, Number(input.limite) || 10),
        );
        const { data, error } = await db()
          .from("pagos")
          .select("monto_usd, plan, estado, creado_en, usuario_id")
          .eq("estado", "aprobado")
          .order("creado_en", { ascending: false })
          .limit(limite);
        if (error) return asJson({ error: error.message });
        if (!data || data.length === 0)
          return asJson({ pagos: [], total_usd: 0 });

        const usuariosIds = [
          ...new Set(data.map((p) => p.usuario_id as string)),
        ];
        const { data: usuarios } = await db()
          .from("usuarios")
          .select("id, email")
          .in("id", usuariosIds);
        const mapaEmail = new Map(
          (usuarios ?? []).map((u) => [u.id as string, u.email as string]),
        );
        const total = data.reduce(
          (acc, p) => acc + (Number(p.monto_usd) || 0),
          0,
        );

        return asJson({
          pagos: data.map((p) => ({
            monto_usd: p.monto_usd,
            plan: p.plan,
            cliente_email: mapaEmail.get(p.usuario_id as string) ?? "(?)",
            fecha: p.creado_en,
          })),
          total_usd: Math.round(total * 100) / 100,
          cantidad: data.length,
        });
      },
    },

    // ============================================================
    // CONVERSACIONES DEL SAAS
    // ============================================================
    {
      name: "listar_conversaciones_recientes",
      description:
        "Lista conversaciones recientes con actividad en las últimas 24h (de cualquier cuenta cliente). Devuelve cliente (teléfono), cuenta destino, modo (IA/HUMANO), último mensaje. Usalo cuando el Patrón pregunta qué conversaciones hay activas, qué chats hay abiertos, qué pasa en los WhatsApp.",
      input_schema: {
        type: "object",
        properties: {
          limite: {
            type: "integer",
            description: "Máximo (default 20, máx 50).",
          },
        },
        required: [],
      },
      ejecutar: async (input) => {
        const limite = Math.min(
          50,
          Math.max(1, Number(input.limite) || 20),
        );
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await db()
          .from("conversaciones")
          .select("id, telefono, nombre_contacto, modo, cuenta_id, ultimo_mensaje_en")
          .gte("ultimo_mensaje_en", hace24h)
          .order("ultimo_mensaje_en", { ascending: false })
          .limit(limite);
        if (error) return asJson({ error: error.message });
        if (!data || data.length === 0)
          return asJson({ conversaciones: [], total: 0 });

        const cuentasIds = [
          ...new Set(data.map((c) => c.cuenta_id as string)),
        ];
        const { data: cuentas } = await db()
          .from("cuentas")
          .select("id, etiqueta")
          .in("id", cuentasIds);
        const mapaEtiqueta = new Map(
          (cuentas ?? []).map((c) => [c.id as string, c.etiqueta as string]),
        );

        return asJson({
          conversaciones: data.map((c) => ({
            cliente_telefono: c.telefono,
            cliente_nombre: c.nombre_contacto,
            modo: c.modo,
            cuenta_destino: mapaEtiqueta.get(c.cuenta_id as string) ?? "(?)",
            ultimo_mensaje_en: c.ultimo_mensaje_en,
          })),
          total: data.length,
        });
      },
    },

    // ============================================================
    // BLOG
    // ============================================================
    {
      name: "generar_articulo_blog",
      description:
        "Genera un artículo de blog completo con IA (texto + portada + imágenes inline según modo) y lo deja como BORRADOR. NO publica automáticamente. Tarda 60-120 segundos. ANTES de invocar esta tool: si el Patrón pidió 'créame un artículo' sin tema o sin especificar modo de imágenes, PREGUNTÁ primero. No asumas tema ni modo.",
      input_schema: {
        type: "object",
        properties: {
          tema: {
            type: "string",
            description:
              "Tema completo del artículo. Cuanto más específico mejor.",
          },
          modo_imagenes: {
            type: "string",
            enum: ["auto", "solo-portada", "completo", "sin-imagenes"],
            description:
              "auto = decide según largo. solo-portada = barato. completo = portada + 2 inlines. sin-imagenes = solo texto.",
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
        if (tema.length < 5) return asJson({ error: "tema muy corto" });
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
        "Lista los últimos 10 borradores de artículos pendientes de publicar. Devuelve JSON.",
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
        return asJson({
          borradores: borradores.map((a) => ({
            id_corto: a.id.slice(0, 8),
            titulo: a.titulo,
            tiempo_lectura_min: a.tiempo_lectura_min,
            creado_en: a.creado_en,
          })),
          total: borradores.length,
        });
      },
    },
    {
      name: "publicar_articulo_blog",
      description:
        "Publica un artículo borrador. ACCIÓN DESTRUCTIVA — antes de invocar, confirmá explícito con el Patrón ('¿Confirmás que publique X?') y solo ejecutá si responde claramente que sí.",
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
        if (!id) return asJson({ error: "falta id_articulo" });
        const r = await ejecutarPublicar(id);
        return r.respuesta;
      },
    },
    {
      name: "obtener_detalle_articulo",
      description:
        "Devuelve detalle de un artículo específico por id corto. JSON.",
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
        if (!id) return asJson({ error: "falta id" });
        let articulo = await obtenerArticuloPorId(id);
        if (!articulo && id.length === 8) {
          const todos = await listarTodosLosArticulos({ limite: 50 });
          const match = todos.find((a) => a.id.startsWith(id));
          if (match) articulo = await obtenerArticuloPorId(match.id);
        }
        if (!articulo) return asJson({ error: `no encontrado: ${id}` });
        return asJson({
          titulo: articulo.titulo,
          estado: articulo.estado,
          slug: articulo.slug,
          resumen: articulo.resumen,
          keywords: articulo.seo_keywords,
          tiempo_lectura_min: articulo.tiempo_lectura_min,
          tiene_portada: !!articulo.imagen_portada_url,
          publicado_en: articulo.publicado_en,
        });
      },
    },
  ];
}
