/**
 * Helpers minimos para exports CSV. Sin libraries — RFC 4180 a mano.
 *
 * - Separador coma
 * - Valores con `,` `"` o newline van envueltos en `"..."` con `"` -> `""`
 * - UTF-8 con BOM para que Excel respete tildes/eñes al abrir
 * - Newlines `\r\n` (Excel friendly)
 */

const BOM = "﻿";
const NL = "\r\n";

export function escaparCSV(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function filaCSV(celdas: Array<string | number | null | undefined>): string {
  return celdas.map(escaparCSV).join(",");
}

export function construirCSV(
  encabezados: string[],
  filas: Array<Array<string | number | null | undefined>>,
): string {
  const lineas: string[] = [filaCSV(encabezados)];
  for (const f of filas) lineas.push(filaCSV(f));
  return BOM + lineas.join(NL) + NL;
}

export function nombreArchivo(prefijo: string, idCuenta: string): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return `${prefijo}_${idCuenta}_${fecha}.csv`;
}

export function headersCSV(
  filename: string,
  truncado: boolean,
): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
  if (truncado) h["X-Truncated"] = "true";
  return h;
}

export const HARDCAP_FILAS = 50_000;
