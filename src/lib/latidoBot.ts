import type { Cuenta } from "./baseDatos";

// Si no hay heartbeat del bot en este lapso (segundos), la cuenta se
// considera "bot inactivo" y el panel muestra el banner rojo.
export const UMBRAL_HEARTBEAT_SEG = 30;

// Período de gracia tras crear una cuenta nueva: durante estos segundos,
// si todavía no hay heartbeat (porque el bot aún no la procesó), asumimos
// optimistamente que está viva. Sin esto el banner parpadea durante ~5s
// cada vez que se crea una cuenta.
export const GRACIA_RECIEN_CREADA_SEG = 30;

export function calcularBotVivo(cuenta: Cuenta): boolean {
  const ahora = Math.floor(Date.now() / 1000);
  if (cuenta.ultimo_heartbeat) {
    const segDesde = ahora - cuenta.ultimo_heartbeat;
    if (segDesde <= UMBRAL_HEARTBEAT_SEG) return true;
  }
  // Período de gracia para cuentas recién creadas (creada_en es ISO).
  const creadaSeg = Math.floor(new Date(cuenta.creada_en).getTime() / 1000);
  const segDesdeCreacion = ahora - creadaSeg;
  if (segDesdeCreacion <= GRACIA_RECIEN_CREADA_SEG) return true;
  return false;
}
