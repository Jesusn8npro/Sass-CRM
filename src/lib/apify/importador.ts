/**
 * Cuando un run de Apify completa (via webhook o sincronizar manual),
 * descargamos sus items y los guardamos en `leads_extraidos`.
 *
 * NO creamos conversaciones — el user las importa explicitamente
 * cuando le da click a "Importar a CRM" en cada lead.
 */
import {
  insertarLeadsExtraidos,
  type InputLeadExtraido,
} from "../baseDatos";
import { leerDataset } from "./cliente";
import { mapearItem } from "./actors";

function normalizarTelefono(t: string | null | undefined): string | null {
  if (!t) return null;
  const digits = t.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

function normalizarEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  const normalizado = e.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) return null;
  return normalizado;
}

export interface ResumenImportacion {
  items_recibidos: number;
  leads_guardados: number;
  con_telefono: number;
  con_email: number;
  con_web: number;
  errores: number;
}

/**
 * Lee el dataset de Apify y persiste los items en leads_extraidos.
 */
export async function importarResultadosRun(input: {
  cuentaId: string;
  apifyDatasetId: string;
  runApifyId: string;
  actorIdInterno: string;
}): Promise<ResumenImportacion> {
  const items = await leerDataset(input.apifyDatasetId, 500);
  const resumen: ResumenImportacion = {
    items_recibidos: items.length,
    leads_guardados: 0,
    con_telefono: 0,
    con_email: 0,
    con_web: 0,
    errores: 0,
  };

  const filas: InputLeadExtraido[] = [];
  for (const itemRaw of items) {
    try {
      const m = mapearItem(input.actorIdInterno, itemRaw);
      if (!m) continue;
      // Limpieza de telefono: WhatsApp espera digitos puros (sin "+",
      // sin espacios). El "+" lo agrega la UI al mostrar.
      const telLimpio = normalizarTelefono(m.telefono);
      const emailLimpio = normalizarEmail(m.email);

      filas.push({
        cuenta_id: input.cuentaId,
        run_apify_id: input.runApifyId,
        nombre: m.nombre,
        telefono: telLimpio,
        email: emailLimpio,
        direccion: m.direccion,
        sitio_web: m.sitio_web,
        categoria: m.categoria,
        raw: m.raw,
      });

      if (telLimpio) resumen.con_telefono += 1;
      if (emailLimpio) resumen.con_email += 1;
      if (m.sitio_web) resumen.con_web += 1;
    } catch (err) {
      resumen.errores += 1;
      console.error("[apify:importador] error en item:", err);
    }
  }

  resumen.leads_guardados = await insertarLeadsExtraidos(filas);
  return resumen;
}
