/**
 * Importa el dump generado por el SQL Editor del viejo proyecto
 * al nuevo proyecto via postgres pooler.
 *
 * Uso: node scripts/import-data.mjs
 * Requiere: exportacion_viejo.json en la raíz del proyecto
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnv(path) {
  const content = readFileSync(path, "utf-8");
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return vars;
}

function parseDbUrl(url) {
  const bracketMatch = url.match(/^postgresql:\/\/postgres:\[([^\]]+)\]@([^:]+):(\d+)\/(.+)$/);
  if (bracketMatch) return { password: bracketMatch[1] };
  const stdMatch = url.match(/^postgresql:\/\/([^:]+):([^@]+)@/);
  if (stdMatch) return { password: stdMatch[2] };
  throw new Error(`No se pudo parsear URL: ${url}`);
}

const env = parseEnv(join(__dirname, "..", ".env.local"));
const { password } = parseDbUrl(env.NEW_DB_URL);

const db = postgres({
  host: "aws-0-us-west-2.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.wvkmxacnsnuuwcggbopv",
  password,
  ssl: "require",
  max: 1,
  prepare: false,
});

console.log("📂 Leyendo exportacion_viejo.json...");
const raw = readFileSync(join(__dirname, "..", "exportacion_viejo.json"), "utf-8");
const parsed = JSON.parse(raw);
const sqlExport = parsed[0]?.sql_export ?? parsed?.sql_export;
if (!sqlExport) throw new Error("No se encontró sql_export en el JSON");

// Separar por los puntos y coma que terminan cada INSERT
const statements = sqlExport
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.startsWith("INSERT"));

console.log(`📋 ${statements.length} tablas a importar\n`);

let ok = 0, errors = 0;
for (const stmt of statements) {
  const tabla = stmt.match(/INTO public\.(\w+)/)?.[1] ?? "desconocida";
  try {
    await db.unsafe(stmt + ";");
    console.log(`  ✅ ${tabla}`);
    ok++;
  } catch (err) {
    console.warn(`  ⚠️  ${tabla}: ${err.message.slice(0, 120)}`);
    errors++;
  }
}

console.log(`\n✅ Importación completa — ${ok} tablas OK, ${errors} con error`);

// Verificación rápida
console.log("\n📊 Verificación:");
const checks = ["usuarios", "cuentas", "conversaciones", "mensajes", "baileys_auth", "productos"];
for (const t of checks) {
  try {
    const [r] = await db`SELECT count(*)::int n FROM public.${db(t)}`;
    console.log(`   ${t}: ${r.n} filas`);
  } catch { /* skip */ }
}

await db.end();
