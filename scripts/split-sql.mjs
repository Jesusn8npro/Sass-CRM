import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

console.log("Leyendo exportacion_viejo.json...");
const raw = readFileSync(join(root, "exportacion_viejo.json"), "utf-8");
const parsed = JSON.parse(raw);
const sqlExport = parsed[0]?.sql_export ?? parsed?.sql_export;

const statements = sqlExport.split(/;\s*\n/).map(s => s.trim()).filter(s => s.startsWith("INSERT"));
console.log(`${statements.length} tablas encontradas`);

mkdirSync(join(root, "scripts", "sql_tables"), { recursive: true });

for (const stmt of statements) {
  const tabla = stmt.match(/INTO public\.(\w+)/)?.[1] ?? "unknown";
  writeFileSync(join(root, "scripts", "sql_tables", `${tabla}.sql`), stmt + ";", "utf-8");
  console.log(`  guardado: ${tabla}.sql`);
}
