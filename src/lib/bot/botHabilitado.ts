/**
 * Lectura robusta del kill switch `BOT_ENABLED`.
 *
 * El valor llega de formas distintas según el entorno: dotenv corta los
 * comentarios inline de un `.env`, pero un panel que inyecta la variable
 * directa al contenedor NO lo hace. Por eso un mismo
 * `BOT_ENABLED=false  # comentario` apagaba el bot en un lado y lo dejaba
 * arrancar en el otro — y el síntoma (dos instancias peleando la sesión,
 * o el bot que no levanta tras un deploy) no se parece en nada a la causa.
 *
 * Acá normalizamos una sola vez: cortamos el comentario, sacamos espacios
 * y comillas, y comparamos en minúsculas.
 */

/** Normaliza el valor crudo de la variable de entorno. */
function normalizar(valor: string | undefined): string {
  if (!valor) return "";
  return valor
    .split("#")[0] // comentario inline que el panel no corta
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
}

/**
 * true si el bot de Baileys debe arrancar. Solo un "false" (o "0"/"no")
 * explícito lo apaga: ausente o cualquier otra cosa significa encendido,
 * que es el comportamiento que espera producción.
 */
export function botHabilitado(): boolean {
  const v = normalizar(process.env.BOT_ENABLED);
  return !(v === "false" || v === "0" || v === "no");
}
