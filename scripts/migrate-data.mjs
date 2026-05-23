/**
 * Script de migración: viejo proyecto → nuevo proyecto.
 * - Lee del proyecto viejo via REST API / Auth Admin API (HTTPS, no requiere TCP directo)
 * - Escribe al nuevo proyecto via postgres pooler (Supavisor port 6543)
 *
 * Uso: node scripts/migrate-data.mjs
 * Requiere en .env.local: NEW_DB_URL, OLD_SERVICE_ROLE_KEY
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

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
  if (bracketMatch) return { user: "postgres", password: bracketMatch[1], host: bracketMatch[2], port: Number(bracketMatch[3]), database: bracketMatch[4] };
  const stdMatch = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (stdMatch) return { user: stdMatch[1], password: stdMatch[2], host: stdMatch[3], port: Number(stdMatch[4]), database: stdMatch[5] };
  throw new Error(`No se pudo parsear URL: ${url}`);
}

// ── Config ───────────────────────────────────────────────────
const env = parseEnv(envPath);
if (!env.NEW_DB_URL) throw new Error("NEW_DB_URL no está en .env.local");
if (!env.OLD_SERVICE_ROLE_KEY) throw new Error("OLD_SERVICE_ROLE_KEY no está en .env.local");

const OLD_REF = "hecrpmywujicgwcqmxbp";
const OLD_BASE = `https://${OLD_REF}.supabase.co`;
const OLD_KEY  = env.OLD_SERVICE_ROLE_KEY;
const OLD_HEADERS = { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}`, Accept: "application/json" };

const newConn = parseDbUrl(env.NEW_DB_URL);
const NEW_PROJECT_REF = "wvkmxacnsnuuwcggbopv";
const NEW_POOLER_HOST = "aws-0-us-west-2.pooler.supabase.com";

const newDb = postgres({
  host: NEW_POOLER_HOST,
  port: 6543,
  database: "postgres",
  user: `postgres.${NEW_PROJECT_REF}`,
  password: newConn.password,
  ssl: "require",
  max: 3,
  prepare: false,
});

// ── Helpers REST ─────────────────────────────────────────────
async function restGet(url) {
  const res = await fetch(url, { headers: OLD_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

// Lee TODAS las filas de una tabla pública via PostgREST (paginado)
async function fetchAllRows(table) {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const url = `${OLD_BASE}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`;
    const rows = await restGet(url);
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// Lee auth.users via Auth Admin API
async function fetchAuthUsers() {
  const PAGE = 1000;
  let page = 1;
  const all = [];
  while (true) {
    const data = await restGet(`${OLD_BASE}/auth/v1/admin/users?page=${page}&per_page=${PAGE}`);
    // La API devuelve { users: [...], aud: "..." } o directamente un array
    const users = Array.isArray(data) ? data : (data.users ?? []);
    all.push(...users);
    if (users.length < PAGE) break;
    page++;
  }
  return all;
}

// Inserta filas en el nuevo proyecto (lotes de 500)
async function insertBatch(schema, tableName, rows) {
  if (rows.length === 0) return;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await newDb`
      INSERT INTO ${newDb(schema)}.${newDb(tableName)} ${newDb(batch)}
      ON CONFLICT DO NOTHING
    `;
  }
}

async function copyTable(tableName) {
  const rows = await fetchAllRows(tableName);
  if (rows.length === 0) { console.log(`  ⬜ ${tableName} — vacía`); return; }
  await insertBatch("public", tableName, rows);
  console.log(`  ✅ ${tableName} — ${rows.length} filas`);
}

// ── Tablas del schema public en orden FK ─────────────────────
const PUBLIC_TABLES = [
  "usuarios", "super_admins", "paquetes_creditos", "categorias_blog",
  "tags_blog", "suscriptores_blog", "rate_limit_windows", "blog_config",
  "blog_cron_runs",
  "cuentas", "pagos", "admin_acciones",
  "creditos", "uso_creditos", "metering_uso", "baileys_auth", "etiquetas",
  "etapas_pipeline", "respuestas_rapidas", "conocimiento", "biblioteca_medios",
  "webhooks_salientes", "threads_config", "auto_seguimientos_pasos",
  "assistants_vapi", "api_keys", "push_subscriptions", "cuenta_miembros",
  "broadcast_logs", "eventos_log", "runs_apify", "productos",
  "conversaciones", "leads_extraidos",
  "mensajes", "bandeja_salida", "citas", "seguimientos_programados",
  "conversacion_etiquetas", "contactos_email", "contactos_telefono",
  "conversacion_productos_interes",
  "conocimiento_chunks",
  "outreach_call_logs", "outreach_email_logs",
  "llamadas_vapi", "llamadas_programadas",
  "articulos_blog", "articulo_tags",
];

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Iniciando migración (REST API → pooler)\n");
  console.log(`   Origen : ${OLD_BASE}`);
  console.log(`   Destino: ${NEW_POOLER_HOST} (postgres.${NEW_PROJECT_REF})\n`);

  // ── 1. auth.users ──────────────────────────────────────────
  console.log("👤 Migrando auth.users via Admin API...");
  try {
    const users = await fetchAuthUsers();
    if (users.length === 0) {
      console.log("  ⬜ auth.users — vacía");
    } else {
      // Mapear campos del Admin API al schema de auth.users
      const BATCH = 100;
      for (let i = 0; i < users.length; i += BATCH) {
        const batch = users.slice(i, i + BATCH).map((u) => ({
          id:                          u.id,
          instance_id:                 "00000000-0000-0000-0000-000000000000",
          aud:                         u.aud ?? "authenticated",
          role:                        u.role ?? "authenticated",
          email:                       u.email ?? null,
          encrypted_password:          "",  // sin contraseña — usuarios deben hacer reset
          email_confirmed_at:          u.email_confirmed_at ?? null,
          invited_at:                  u.invited_at ?? null,
          confirmation_token:          "",
          confirmation_sent_at:        null,
          recovery_token:              "",
          recovery_sent_at:            null,
          email_change_token_new:      "",
          email_change:                "",
          email_change_sent_at:        null,
          last_sign_in_at:             u.last_sign_in_at ?? null,
          raw_app_meta_data:           u.app_metadata   ?? {},
          raw_user_meta_data:          u.user_metadata  ?? {},
          is_super_admin:              false,
          created_at:                  u.created_at ?? new Date().toISOString(),
          updated_at:                  u.updated_at ?? new Date().toISOString(),
          phone:                       u.phone ?? null,
          phone_confirmed_at:          u.phone_confirmed_at ?? null,
          phone_change:                "",
          phone_change_token:          "",
          phone_change_sent_at:        null,
          email_change_token_current:  "",
          email_change_confirm_status: 0,
          banned_until:                u.banned_until ?? null,
          reauthentication_token:      "",
          reauthentication_sent_at:    null,
          is_sso_user:                 u.is_sso_user ?? false,
          deleted_at:                  u.deleted_at ?? null,
        }));
        await newDb`INSERT INTO auth.users ${newDb(batch)} ON CONFLICT (id) DO NOTHING`;
      }
      console.log(`  ✅ auth.users — ${users.length} usuarios`);
      console.log("  ⚠️  Contraseñas no migradas — usuarios deben hacer \"Olvidé mi contraseña\"");
    }

    // auth.identities (viene en el objeto de usuario)
    const identities = users.flatMap((u) => (u.identities ?? []).map((id) => ({
      id:             id.id,
      provider:       id.provider,
      user_id:        id.user_id,
      identity_data:  id.identity_data ?? {},
      last_sign_in_at: id.last_sign_in_at ?? null,
      created_at:     id.created_at ?? null,
      updated_at:     id.updated_at ?? null,
      email:          id.email ?? (id.identity_data?.email ?? null),
    })));
    if (identities.length > 0) {
      await newDb`INSERT INTO auth.identities ${newDb(identities)} ON CONFLICT DO NOTHING`;
      console.log(`  ✅ auth.identities — ${identities.length} filas`);
    }
  } catch (err) {
    console.warn("  ⚠️  auth.users:", err.message);
  }

  // ── 2. Public schema ───────────────────────────────────────
  console.log("\n📦 Migrando schema public...");
  for (const table of PUBLIC_TABLES) {
    try {
      await copyTable(table);
    } catch (err) {
      console.warn(`  ⚠️  ${table}: ${err.message}`);
    }
  }

  console.log("\n✅ Migración completa!\n");

  // ── Verificación ───────────────────────────────────────────
  console.log("📊 Verificación (conteo en nuevo proyecto):");
  const checks = ["usuarios", "cuentas", "conversaciones", "mensajes", "productos", "articulos_blog"];
  for (const t of checks) {
    try {
      const [r] = await newDb`SELECT count(*)::int as n FROM public.${newDb(t)}`;
      console.log(`   ${t}: ${r.n} filas`);
    } catch { /* tabla puede no existir */ }
  }

  await newDb.end();
}

main().catch((err) => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
