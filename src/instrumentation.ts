// Hook de Next.js que corre una vez al arrancar el server.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Acá levantamos el bot de Baileys *dentro del mismo proceso que Next*,
// así no hace falta abrir una segunda terminal con `npm run start:bot`
// y el banner "Bot inactivo" del panel deja de tener sentido.
export async function register(): Promise<void> {
  // Solo en el runtime de Node (no Edge).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Permite desactivarlo si alguien quiere correr el bot aparte.
  if (process.env.BOT_EN_PROCESO === "0") return;

  const { arrancarBotEnProceso } = await import("@/lib/bot/cicloVida");
  await arrancarBotEnProceso();
}
