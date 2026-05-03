// Hook de Next.js que corre una vez al arrancar el server.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Levanta el bot de Baileys dentro del mismo proceso que Next.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { arrancarBotEnProceso } = await import("@/lib/bot/cicloVida");
    await arrancarBotEnProceso();
    console.log("[instrumentation] bot arrancado OK");
  } catch (err) {
    console.error("[instrumentation] error arrancando el bot:", err);
  }
}
