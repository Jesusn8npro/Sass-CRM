/**
 * Cuando un run de Apify completa, descargamos sus items y los
 * mergeamos a las tablas existentes contactos_email y
 * contactos_telefono. Crea conversaciones nuevas si no existen.
 *
 * Devuelve métricas para mostrarle al usuario qué se importó.
 */
import {
  guardarContactosEmail,
  guardarContactosTelefono,
  obtenerOCrearConversacion,
} from "../baseDatos";
import { leerDataset } from "./cliente";
import { mapearItem, type ItemContactoExtraido } from "./actors";

export interface ResumenImportacion {
  items_recibidos: number;
  contactos_creados: number;
  emails_creados: number;
  telefonos_creados: number;
  emails_sospechosos: string[];
  errores: number;
}

export async function importarResultadosRun(input: {
  cuentaId: string;
  apifyDatasetId: string;
  actorIdInterno: string;
  /** Etiqueta opcional para los contactos importados. */
  etiquetaImportacion?: string;
}): Promise<ResumenImportacion> {
  const items = await leerDataset(input.apifyDatasetId);
  const resumen: ResumenImportacion = {
    items_recibidos: items.length,
    contactos_creados: 0,
    emails_creados: 0,
    telefonos_creados: 0,
    emails_sospechosos: [],
    errores: 0,
  };

  for (const itemRaw of items) {
    try {
      const item = mapearItem(input.actorIdInterno, itemRaw);
      if (!item) continue;
      await procesarItem(input.cuentaId, item, resumen);
    } catch (err) {
      resumen.errores += 1;
      console.error("[apify:importador] error en item:", err);
    }
  }

  return resumen;
}

async function procesarItem(
  cuentaId: string,
  item: ItemContactoExtraido,
  resumen: ResumenImportacion,
): Promise<void> {
  // Necesitamos un teléfono para crear la conversación. Si no hay
  // teléfono pero hay email, generamos un identificador interno
  // (formato "lead_<random>") para no romper la FK de conversaciones.
  const telefonoPlaceholder = (item.telefono ?? `lead_${randomId()}`)
    .replace(/[^\d+a-zA-Z_]/g, "")
    .slice(0, 32);

  const conv = await obtenerOCrearConversacion(
    cuentaId,
    telefonoPlaceholder,
    item.nombre,
    null,
  );
  resumen.contactos_creados += 1;

  if (item.email) {
    const r = await guardarContactosEmail(cuentaId, conv.id, [item.email]);
    resumen.emails_creados += r.nuevos ?? 0;
    if (r.sospechosos?.length) {
      resumen.emails_sospechosos.push(...r.sospechosos);
    }
  }

  if (item.telefono && !item.telefono.startsWith("lead_")) {
    const nuevos = await guardarContactosTelefono(
      cuentaId,
      conv.id,
      [item.telefono],
      telefonoPlaceholder,
    );
    resumen.telefonos_creados += nuevos ?? 0;
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
