// Splits a large single-INSERT sql_tables file into chunked INSERT files
// Usage: node scripts/chunk-sql.mjs <table_name> <chunk_size>
// Output: scripts/sql_chunks/<table>_chunk_NNN.sql

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const table = process.argv[2];
const chunkSize = parseInt(process.argv[3] || '100', 10);

if (!table) {
  console.error('Usage: node chunk-sql.mjs <table_name> [chunk_size]');
  process.exit(1);
}

const inputPath = join(__dirname, 'sql_tables', `${table}.sql`);
const outDir = join(__dirname, 'sql_chunks');
mkdirSync(outDir, { recursive: true });

const sql = readFileSync(inputPath, 'utf8').trim();

// Extract: INSERT INTO public.<table> OVERRIDING SYSTEM VALUE SELECT * FROM json_populate_recordset(null::public.<table>, $JSON$[...]$JSON$) ON CONFLICT DO NOTHING;
const match = sql.match(/^(INSERT INTO public\.\S+\s+OVERRIDING SYSTEM VALUE SELECT \* FROM json_populate_recordset\(null::public\.\S+,\s*\$JSON\$)(\[.*\])(\$JSON\$\) ON CONFLICT DO NOTHING;);*$/s);

if (!match) {
  console.error('Could not parse SQL format');
  process.exit(1);
}

const prefix = match[1];
const jsonArray = match[2];
const suffix = match[3];

const rows = JSON.parse(jsonArray);
console.log(`Table: ${table}, Total rows: ${rows.length}, Chunk size: ${chunkSize}`);

let chunkNum = 0;
for (let i = 0; i < rows.length; i += chunkSize) {
  chunkNum++;
  const chunk = rows.slice(i, i + chunkSize);
  const chunkSql = `${prefix}${JSON.stringify(chunk)}${suffix}`;
  const outFile = join(outDir, `${table}_chunk_${String(chunkNum).padStart(3, '0')}.sql`);
  writeFileSync(outFile, chunkSql, 'utf8');
  console.log(`  Chunk ${chunkNum}: rows ${i + 1}-${Math.min(i + chunkSize, rows.length)} → ${outFile}`);
}

console.log(`Done. ${chunkNum} chunks created.`);
