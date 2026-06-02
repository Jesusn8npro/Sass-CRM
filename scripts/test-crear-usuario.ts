/* Prueba la creación de un usuario (Auth Admin API) del operador.
 * Uso: npx tsx scripts/test-crear-usuario.ts [email] [password] */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const envRaw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const linea of envRaw.split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const CUENTA_ID = "9fe317c1-d1b3-4c4a-a763-61f57b656c11";
const email = process.argv[2] || "sumadre89@gmail.com";
const password = process.argv[3] || "898989";

async function main() {
  const { crearUsuarioAuthExterno } = await import("@/lib/db/supabaseExterno");
  const r = await crearUsuarioAuthExterno(CUENTA_ID, email, password);
  console.log("RESULTADO:", JSON.stringify(r, null, 2));
  process.exit(0);
}
main().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
