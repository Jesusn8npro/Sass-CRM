/**
 * fix-chunk.mjs — sanitise a chunk SQL file before MCP execute_sql.
 * Replaces characters that the MCP JSON transport corrupts:
 *   U+201C / U+201D (smart quotes) → “ / ”  (valid JSON escapes)
 * Usage: node scripts/fix-chunk.mjs <in.sql> [out.sql]
 *   If out.sql is omitted, overwrites in.sql in-place.
 */
import { readFileSync, writeFileSync } from 'fs';

const inFile = process.argv[2];
const outFile = process.argv[3] || inFile;

if (!inFile) { console.error('Usage: fix-chunk.mjs <in.sql> [out.sql]'); process.exit(1); }

const sql = readFileSync(inFile, 'utf8');

const fixed = sql
  .replace(/“/g, '\\u201c')
  .replace(/”/g, '\\u201d');

const changed = (sql.match(/[“”]/g) || []).length;
if (changed) console.log(`Replaced ${changed} curly-quote characters`);

writeFileSync(outFile, fixed, 'utf8');

// Validate JSON part
const start = fixed.indexOf('$JSON$') + 6;
const end = fixed.lastIndexOf('$JSON$');
if (start > 6 && end > start) {
  JSON.parse(fixed.slice(start, end));
  console.log('JSON valid');
}

if (outFile !== inFile) console.log(`Written: ${outFile}`);
else if (changed) console.log(`Fixed in-place: ${outFile}`);
