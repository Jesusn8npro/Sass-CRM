// Modo legacy: corre el bot como proceso suelto (sin Next.js).
// En la práctica ya no hace falta — instrumentation.ts arranca el
// bot dentro del propio proceso de Next. Mantenemos este script
// como fallback (BOT_EN_PROCESO=0) o para debug aislado.
import "./cargador-entorno";
import { arrancarBotEnProceso } from "../src/lib/bot/cicloVida";

arrancarBotEnProceso().catch((err) => {
  console.error("[bot] error fatal arrancando el bot:", err);
  process.exit(1);
});
