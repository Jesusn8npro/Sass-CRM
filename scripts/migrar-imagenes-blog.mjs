// Migra imágenes del blog desde el proyecto Supabase viejo al nuevo.
// Lee SUPABASE_SERVICE_ROLE_KEY desde .env.local automáticamente.
// Uso: node scripts/migrar-imagenes-blog.mjs

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

// --- leer .env.local ---
function leerEnv() {
  const env = {};
  try {
    const lines = readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    }
  } catch {
    console.error('No se pudo leer .env.local');
    process.exit(1);
  }
  return env;
}

const env = leerEnv();
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const NUEVO_PROJECT_ID = 'wvkmxacnsnuuwcggbopv';
const NUEVO_URL = `https://${NUEVO_PROJECT_ID}.supabase.co`;

if (!SERVICE_ROLE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const IMAGENES = [
  { id: '629793d0-2cf4-4f79-8427-cb3de1769a9a', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/agentes-ia-2025-ventas-negocios-latinos-45a1f212.jpg' },
  { id: '8fb12830-b994-437d-8c5f-c5f1c7a901fd', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/agentes-whatsapp-ventas-agenda-notificaciones-1e7afb95.jpg' },
  { id: 'afd3421b-d0fc-4ba3-89eb-782d7fdc0ad8', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/cannabis-productividad-ia-6d4e1b89.jpg' },
  { id: 'a7790f70-2f3d-4579-8d0a-6938c3e48ede', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/de-llorar-a-sonreir-como-la-automatizacion-transforma-tu-negocio-38036793.jpg' },
  { id: 'b780bd85-929b-4857-9f7d-1f6badc32be1', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/deje-de-contratar-vendedores-agente-ia-29b5c798.jpg' },
  { id: '5699205d-61d8-40b4-807f-d1f80e93d003', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/empleado-invisible-ventas-whatsapp-99ce4aa2.jpg' },
  { id: 'db41df00-417c-4cdd-a0fe-2ad5934c8386', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/ia-dominara-el-mundo-43546c9d.jpg' },
  { id: 'aa24bf40-69ca-485d-b82a-9e92c409cc61', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/ia-pandemia-2026-oportunidades-pymes-c36da4ae.jpg' },
  { id: '40b12a2b-7971-4a38-a466-2c69e5b0f3dc', url: 'https://hecrpmywujicgwcqmxbp.supabase.co/storage/v1/object/public/blog/portadas/predicciones-ia-2026-cddfe797.jpg' },
];

const CARPETA_LOCAL = join(ROOT, 'scripts', 'blog-images');

function nombreArchivo(url) {
  return url.split('/portadas/')[1];
}

function cargarLocal(nombre) {
  const ruta = join(CARPETA_LOCAL, nombre);
  if (!existsSync(ruta)) throw new Error(`Archivo no encontrado: ${ruta}`);
  return readFileSync(ruta).buffer;
}

async function descargar(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  return res.arrayBuffer();
}

async function subirStorage(nombre, buffer) {
  const res = await fetch(`${NUEVO_URL}/storage/v1/object/blog/portadas/${nombre}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Storage upload falló (${res.status}): ${txt}`);
  }
}

async function actualizarDB(id, nuevaUrl) {
  const res = await fetch(`${NUEVO_URL}/rest/v1/articulos_blog?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ imagen_portada_url: nuevaUrl }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DB update falló (${res.status}): ${txt}`);
  }
}

async function main() {
  console.log(`Migrando ${IMAGENES.length} imágenes...\n`);
  let ok = 0;
  let errores = 0;

  for (const img of IMAGENES) {
    const nombre = nombreArchivo(img.url);
    const nuevaUrl = `${NUEVO_URL}/storage/v1/object/public/blog/portadas/${nombre}`;
    process.stdout.write(`  ${nombre} ... `);
    try {
      let buffer;
      try {
        buffer = cargarLocal(nombre);
        process.stdout.write('(local) ');
      } catch {
        buffer = await descargar(img.url);
        process.stdout.write('(web) ');
      }
      await subirStorage(nombre, buffer);
      await actualizarDB(img.id, nuevaUrl);
      console.log('✓');
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      errores++;
    }
  }

  console.log(`\nResultado: ${ok} OK, ${errores} errores`);
}

main();
