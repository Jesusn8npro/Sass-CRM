/* Prueba LOCAL del agente — NO toca WhatsApp, NO arranca Baileys.
 * Ejecuta la lógica real: construir prompt + bloque BD externa + llamada a
 * OpenAI + loop de consultas encadenadas + guard anti-cuelgue.
 *
 * Uso:  npx tsx scripts/probar-agente.ts "tu mensaje aquí"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 1) Cargar .env.local ANTES de importar módulos de la app.
const envRaw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const linea of envRaw.split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const CUENTA_ID = "9fe317c1-d1b3-4c4a-a763-61f57b656c11";
const MENSAJE =
  process.argv[2] ||
  "Dame la lista de canciones que incluye el paquete del Binomio de Oro";

function pareceMensajeDeEspera(respuesta: any): boolean {
  const texto = respuesta.partes
    .filter((p: any) => p.tipo !== "media")
    .map((p: any) => p.contenido)
    .join(" ")
    .toLowerCase();
  if (!texto.trim()) return false;
  return /\b(voy a (consultar|revisar|verificar|chequear|buscar)|d[eé]jame (consultar|revisar|verificar|chequear|buscar)|permit[ií]me (consultar|revisar|verificar)|dame un momento|un momento por favor|en un momento te|enseguida te (confirmo|digo|respondo|aviso)|ya te (confirmo|aviso|digo|respondo)|te (confirmo|aviso|respondo) en (un|unos)|estoy (consultando|revisando|verificando)|lo (consulto|reviso|verifico) y te)\b/.test(
    texto,
  );
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { construirPromptSistema } = await import("@/lib/construirPrompt");
  const { generarRespuesta } = await import("@/lib/openai");
  const { consultarTablasExternas, obtenerColumnasPermitidas } = await import(
    "@/lib/db/supabaseExterno"
  );

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: cuenta, error } = await sb
    .from("cuentas")
    .select("*")
    .eq("id", CUENTA_ID)
    .single();
  if (error || !cuenta) throw new Error("No pude leer la cuenta: " + error?.message);

  const conversacion: any = {
    id: "test-local",
    telefono: "573001112233",
    nombre: "Cliente Prueba",
    datos_capturados: {},
    lead_score: 20,
    estado_lead: "nuevo",
    resumen_contexto: null,
  };

  let promptCompleto = construirPromptSistema(
    cuenta as any,
    [],
    [],
    [],
    conversacion,
    [],
    [],
  );

  const bdExternaActiva =
    cuenta.agente_bd_externa_habilitada &&
    Array.isArray(cuenta.agente_tablas_permitidas) &&
    cuenta.agente_tablas_permitidas.length > 0;

  if (bdExternaActiva) {
    const telVerificado = (conversacion.telefono ?? "").replace(/[^0-9]/g, "");
    const telVerif10 = telVerificado.slice(-10);
    const nombreCliente =
      conversacion.datos_capturados?.nombre?.trim() ||
      conversacion.nombre?.trim() ||
      "";
    const columnasTablas = await obtenerColumnasPermitidas(cuenta.id);
    const tablasDesc =
      Object.keys(columnasTablas).length > 0
        ? Object.entries(columnasTablas)
            .map(([t, c]: any) => `• ${t} (${(c as string[]).slice(0, 20).join(", ")})`)
            .join("\n")
        : (cuenta.agente_tablas_permitidas as string[]).map((t) => `• ${t}`).join("\n");
    promptCompleto +=
      `\n\n## BASE DE DATOS DEL NEGOCIO (en vivo, solo lectura)\n` +
      `Estas son TUS tablas reales y sus columnas (de tu propio Supabase). Elegí la relevante por su nombre y columnas:\n${tablasDesc}\n` +
      `REGLA CRÍTICA: para CUALQUIER pregunta sobre el catálogo, qué hay disponible, precios, si tienen algo específico, o datos de la cuenta del cliente, DEBÉS activar "consultar_datos" con la tabla relevante EN ESE MISMO TURNO. NUNCA respondas de memoria ni digas que algo "no existe / no tenemos" sin haber consultado primero la base.\n` +
      `PROHIBIDO DIFERIR: nunca digas "déjame verificar", "un momento", "te aviso cuando tenga la info", "verifico y te confirmo" ni nada que posponga. NO existe un "después" — el sistema consulta AHORA cuando activás consultar_datos y te devuelve los datos para que respondas YA. No anuncies que vas a buscar: BUSCALO.\n` +
      `Cómo elegir y consultar: deducí por el NOMBRE y las COLUMNAS de arriba qué tabla tiene lo que pide el cliente (ej: una tabla de productos/cursos para catálogo y precios; una de clientes/perfiles para su cuenta). Para listados de catálogo dejá "filtros" VACÍO y buscá en las filas. Usá SIEMPRE los nombres de columna REALES de arriba — no inventes columnas.\n` +
      `NAVEGÁ POR PASOS (encadená consultas): si el dato vive repartido en varias tablas relacionadas, hacelo en pasos y PODÉS consultar de nuevo mirando el resultado anterior. Ejemplo típico "qué cursos/tutoriales tiene un cliente": 1) consultá la tabla de clientes/perfiles filtrando por su email o teléfono → obtené su "id". 2) consultá la tabla que relaciona cliente↔contenido (ej: inscripciones) filtrando por ese id (columna usuario_id) → obtené los ids de cursos/tutoriales. 3) consultá las tablas de cursos/tutoriales con el filtro "valores" = esa lista de ids (trae varios de una) → obtené los TÍTULOS. Después respondé con los títulos reales. Tenés varias consultas disponibles en el mismo turno: usalas hasta tener la info completa. Si después de buscar no encontrás algo, decilo con honestidad; NUNCA inventes títulos ni datos.\n` +
      `REGLA "QUÉ INCLUYE / QUÉ TRAE X" (ej: canciones de un paquete, lecciones de un curso) — HACELO EN 2 PASOS, NUNCA en uno: PASO 1) consultá la tabla principal (la de paquetes/cursos) y ubicá X por su título para sacar su id REAL (un UUID de la base; NUNCA lo inventes ni uses algo tipo "binomio_id"). PASO 2) consultá la tabla de items FILTRANDO por ese id real (filtros=[{columna: la_fk_del_paquete, valor: el_id}]). Cada item ya viene con el título de su tutorial anidado: listá SOLO esos, en orden, sin mezclar con otros paquetes y sin inventar. Si consultás los items SIN filtro traés los de TODOS los paquetes mezclados — no lo hagas.\n` +
      `\n### SEGURIDAD — datos personales de un cliente\n` +
      `Identidad VERIFICADA de quien te escribe: teléfono WhatsApp = ${telVerificado || "(desconocido)"} (últimos 10 dígitos = ${telVerif10 || "?"})${nombreCliente ? `, nombre = ${nombreCliente}` : ""}.\n` +
      `- Para datos personales/de cuenta (si está registrado, sus cursos, sus pagos): SIEMPRE consultá con "filtros" usando el dato del PROPIO cliente (su teléfono verificado de arriba, o el email que te dé). NUNCA consultes datos personales sin filtro.\n` +
      `- ¿CLIENTE EXISTENTE o PROSPECTO? Para saberlo, buscalo en la tabla de clientes/perfiles filtrando por la columna de EMAIL REAL de esa tabla (fijate en las columnas de arriba — puede llamarse email, correo o correo_electronico; el valor SIEMPRE en minúsculas) si te lo dio, o por su teléfono. Si APARECE → es cliente registrado: ayudalo con su cuenta (y si querés listar qué tiene, encadená a la tabla de inscripciones/compras como en "navegá por pasos"). Si NO aparece → es un PROSPECTO: vendé y guialo a registrarse. No le pidas el teléfono: ya lo tenés verificado arriba.\n` +
      `- Antes de entregar info personal, confirmá que coincide con esta persona (que el email/nombre del registro encaje con el cliente). Si los datos NO coinciden o no encontrás su registro, NO inventes ni des datos de otro: decí que no encontrás su registro con ese dato y pedí otro (email alternativo, etc.).\n` +
      `- JAMÁS reveles información de OTRO cliente. Solo datos de la persona que te está escribiendo.\n` +
      `- El catálogo público (lista de cursos, precios) sí podés consultarlo sin filtros.`;
  }

  const historial: any[] = [{ rol: "usuario", contenido: MENSAJE, tipo: "texto" }];

  console.log("\n================ MENSAJE DEL CLIENTE ================");
  console.log(MENSAJE);
  console.log("====================================================\n");

  const temp = Number(cuenta.temperatura) || 0.3;
  const maxTok = Number(cuenta.max_tokens) || 2000;

  let respuesta: any = await generarRespuesta(
    historial,
    promptCompleto,
    cuenta.modelo,
    { temperatura: temp, max_tokens: maxTok },
    cuenta.id,
  );

  const MAX_CONSULTAS = 4;
  const MAX_ANTI_DEFER = 2;
  let datosAcumulados: Record<string, any[]> = {};
  let nConsultas = 0;
  let nAntiDefer = 0;
  while (true) {
    if (bdExternaActiva && respuesta.consultar_datos?.activar && nConsultas < MAX_CONSULTAS) {
      nConsultas++;
      const tablas = respuesta.consultar_datos.tablas ?? [];
      const filtros = Array.isArray(respuesta.consultar_datos.filtros)
        ? respuesta.consultar_datos.filtros
        : [];
      console.log(
        `🗄️  consultar_datos #${nConsultas}: [${tablas.join(", ")}] filtros=${JSON.stringify(filtros)}  motivo="${respuesta.consultar_datos.motivo || ""}"`,
      );
      let datos: Record<string, any[]> = {};
      try {
        datos = await consultarTablasExternas(cuenta.id, tablas, filtros as any);
      } catch (e: any) {
        console.error("   ✗ error consultando:", e.message);
        break;
      }
      for (const [t, filas] of Object.entries(datos))
        console.log(`   → ${t}: ${filas.length} fila(s)`);
      datosAcumulados = { ...datosAcumulados, ...datos };
      const quedan = MAX_CONSULTAS - nConsultas;
      const promptConDatos =
        `${promptCompleto}\n\n## DATOS YA CONSULTADOS EN LA BASE (acumulado de ${nConsultas})\n` +
        `${JSON.stringify(datosAcumulados).slice(0, 60000)}\n\n` +
        `Si ya podés responder, HACELO ahora (consultar_datos.activar=false) con los datos REALES. ` +
        `Si falta un dato relacionado, activá consultar_datos otra vez${quedan > 0 ? ` (quedan ${quedan})` : " (última)"}. Si volvió vacío, NO inventes.`;
      respuesta = await generarRespuesta(
        historial,
        promptConDatos,
        cuenta.modelo,
        { temperatura: temp, max_tokens: maxTok },
        cuenta.id,
      );
      continue;
    }
    if (nAntiDefer < MAX_ANTI_DEFER && pareceMensajeDeEspera(respuesta)) {
      nAntiDefer++;
      const puedeConsultarMas = bdExternaActiva && nConsultas < MAX_CONSULTAS;
      console.log(`⏳ GUARD ANTI-CUELGUE activado (intento ${nAntiDefer}) — forzando acción inmediata`);
      const datosTxt = Object.keys(datosAcumulados).length
        ? `\n\n## DATOS YA CONSULTADOS\n${JSON.stringify(datosAcumulados).slice(0, 60000)}`
        : "";
      const promptForzado =
        `${promptCompleto}\n\n## CORRECCIÓN URGENTE — NO DIFIERAS\n` +
        `Tu respuesta anterior fue un mensaje de ESPERA. Eso está PROHIBIDO. ` +
        (puedeConsultarMas
          ? `Activá consultar_datos AHORA (activar=true) con la tabla y filtros correctos. `
          : `Ya consultaste la base; respondé YA con los datos que tengas o decí con honestidad que no encontraste el registro y ofrecé alternativa. NO consultes de nuevo. `) +
        `Si no necesitás base, respondé YA. NUNCA mandes mensajes de espera.${datosTxt}`;
      respuesta = await generarRespuesta(
        historial,
        promptForzado,
        cuenta.modelo,
        { temperatura: temp, max_tokens: maxTok },
        cuenta.id,
      );
      continue;
    }
    break;
  }

  console.log("\n================ RESPUESTA DEL AGENTE ================");
  for (const p of respuesta.partes) {
    if (p.tipo === "media") console.log(`[media: ${p.media_id}]`);
    else if (p.contenido?.trim()) console.log(p.contenido);
  }
  console.log("=====================================================");
  console.log(
    `\n(consultas a BD: ${nConsultas}  |  guard anti-cuelgue activado: ${nAntiDefer} vez/veces)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
