import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { PROMPT_SISTEMA_DEFAULT } from "./promptSistema";

// ============================================================
// Tipos
// ============================================================
export type ModoConversacion = "IA" | "HUMANO";
export type RolMensaje = "usuario" | "asistente" | "humano" | "sistema";
export type TipoMensaje =
  | "texto"
  | "audio"
  | "imagen"
  | "video"
  | "documento"
  | "sistema";
export type EstadoConexion =
  | "desconectado"
  | "qr"
  | "conectando"
  | "conectado";

export interface Cuenta {
  id: number;
  etiqueta: string;
  telefono: string | null;
  estado: EstadoConexion;
  cadena_qr: string | null;
  ultimo_heartbeat: number | null;
  prompt_sistema: string;
  contexto_negocio: string;
  buffer_segundos: number;
  modelo: string | null;
  voz_elevenlabs: string | null;
  esta_activa: 0 | 1;
  esta_archivada: 0 | 1;
  actualizada_en: number;
  creada_en: number;
}

export interface EntradaConocimiento {
  id: number;
  cuenta_id: number;
  titulo: string;
  contenido: string;
  orden: number;
  creada_en: number;
  actualizada_en: number;
}

export interface RespuestaRapida {
  id: number;
  cuenta_id: number;
  atajo: string;
  texto: string;
  orden: number;
  creada_en: number;
  actualizada_en: number;
}

export interface Etiqueta {
  id: number;
  cuenta_id: number;
  nombre: string;
  color: string;
  descripcion: string | null;
  orden: number;
  creada_en: number;
}

export type TipoMediaBiblioteca = "imagen" | "video" | "audio" | "documento";

export interface MedioBiblioteca {
  id: number;
  cuenta_id: number;
  identificador: string; // slug que el AI usa para referenciar (ej: "catalogo_2025")
  tipo: TipoMediaBiblioteca;
  ruta_archivo: string; // path relativo dentro de data/biblioteca/{cuentaId}/
  descripcion: string;
  creado_en: number;
}

export interface Conversacion {
  id: number;
  cuenta_id: number;
  telefono: string;
  jid_wa: string | null;
  nombre: string | null;
  modo: ModoConversacion;
  necesita_humano: 0 | 1;
  ultimo_mensaje_en: number | null;
  creada_en: number;
}

export interface EtiquetaResumen {
  id: number;
  nombre: string;
  color: string;
}

export interface ConversacionConPreview extends Conversacion {
  vista_previa_ultimo_mensaje: string | null;
  etiquetas: EtiquetaResumen[];
}

export interface Mensaje {
  id: number;
  cuenta_id: number;
  conversacion_id: number;
  rol: RolMensaje;
  tipo: TipoMensaje;
  contenido: string;
  media_path: string | null;
  creado_en: number;
}

export interface FilaBandejaSalida {
  id: number;
  cuenta_id: number;
  conversacion_id: number;
  telefono: string;
  tipo: TipoMensaje;
  contenido: string;
  media_path: string | null;
  enviado: 0 | 1;
  creado_en: number;
}

// ============================================================
// Apertura de la base de datos
// ============================================================
const directorioDatos = path.resolve(process.cwd(), "data");
if (!fs.existsSync(directorioDatos)) {
  fs.mkdirSync(directorioDatos, { recursive: true });
}

const rutaBaseDatos = path.join(directorioDatos, "messages.db");
const db = new Database(rutaBaseDatos);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// Migración: detectar schema viejo en inglés y wipear
// (los datos de prueba se descartan; auth/{id}/ se preserva)
// ============================================================
const tieneSchemaIngles = !!db
  .prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'`,
  )
  .get();

if (tieneSchemaIngles) {
  console.log("[baseDatos] Schema viejo detectado, migrando a español...");
  db.exec(`
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS outbox;
    DROP TABLE IF EXISTS connection_state;
  `);
}

// ============================================================
// Schema en español
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS cuentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etiqueta TEXT NOT NULL,
    telefono TEXT,
    estado TEXT CHECK(estado IN ('desconectado','qr','conectando','conectado'))
      NOT NULL DEFAULT 'desconectado',
    cadena_qr TEXT,
    ultimo_heartbeat INTEGER,
    prompt_sistema TEXT NOT NULL DEFAULT '',
    contexto_negocio TEXT NOT NULL DEFAULT '',
    buffer_segundos INTEGER NOT NULL DEFAULT 0,
    modelo TEXT,
    voz_elevenlabs TEXT,
    esta_activa INTEGER NOT NULL DEFAULT 1,
    esta_archivada INTEGER NOT NULL DEFAULT 0,
    actualizada_en INTEGER NOT NULL DEFAULT (unixepoch()),
    creada_en INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS conocimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    creada_en INTEGER NOT NULL DEFAULT (unixepoch()),
    actualizada_en INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_conocimiento_cuenta
    ON conocimiento(cuenta_id, orden);

  CREATE TABLE IF NOT EXISTS respuestas_rapidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    atajo TEXT NOT NULL,
    texto TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    creada_en INTEGER NOT NULL DEFAULT (unixepoch()),
    actualizada_en INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_respuestas_rapidas_cuenta
    ON respuestas_rapidas(cuenta_id, orden);

  CREATE TABLE IF NOT EXISTS etiquetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'zinc',
    descripcion TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    creada_en INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_etiquetas_cuenta
    ON etiquetas(cuenta_id, orden);

  CREATE TABLE IF NOT EXISTS conversacion_etiquetas (
    conversacion_id INTEGER NOT NULL,
    etiqueta_id INTEGER NOT NULL,
    asignada_en INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (conversacion_id, etiqueta_id)
  );

  CREATE INDEX IF NOT EXISTS idx_conv_etiquetas_etiqueta
    ON conversacion_etiquetas(etiqueta_id);

  CREATE TABLE IF NOT EXISTS biblioteca_medios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    identificador TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('imagen','video','audio','documento')),
    ruta_archivo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    creado_en INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(cuenta_id, identificador)
  );

  CREATE INDEX IF NOT EXISTS idx_biblioteca_cuenta
    ON biblioteca_medios(cuenta_id);

  CREATE TABLE IF NOT EXISTS conversaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    telefono TEXT NOT NULL,
    jid_wa TEXT,
    nombre TEXT,
    modo TEXT CHECK(modo IN ('IA','HUMANO')) NOT NULL DEFAULT 'IA',
    necesita_humano INTEGER NOT NULL DEFAULT 0,
    ultimo_mensaje_en INTEGER,
    creada_en INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(cuenta_id, telefono)
  );

  CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    conversacion_id INTEGER NOT NULL REFERENCES conversaciones(id),
    rol TEXT CHECK(rol IN ('usuario','asistente','humano','sistema')) NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'texto',
    contenido TEXT NOT NULL,
    media_path TEXT,
    creado_en INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion
    ON mensajes(conversacion_id, creado_en);
  CREATE INDEX IF NOT EXISTS idx_mensajes_cuenta
    ON mensajes(cuenta_id);

  CREATE TABLE IF NOT EXISTS bandeja_salida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    conversacion_id INTEGER NOT NULL,
    telefono TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'texto',
    contenido TEXT NOT NULL,
    media_path TEXT,
    enviado INTEGER NOT NULL DEFAULT 0,
    creado_en INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_bandeja_pendientes
    ON bandeja_salida(enviado, creado_en);
  CREATE INDEX IF NOT EXISTS idx_bandeja_cuenta
    ON bandeja_salida(cuenta_id);
`);

// Migración: agregar columnas nuevas a DBs creadas con versiones previas
function asegurarColumna(tabla: string, nombre: string, definicion: string): void {
  const cols = db
    .prepare(`PRAGMA table_info(${tabla})`)
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === nombre)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${definicion}`);
  }
}

asegurarColumna(
  "cuentas",
  "contexto_negocio",
  "TEXT NOT NULL DEFAULT ''",
);
asegurarColumna(
  "cuentas",
  "buffer_segundos",
  "INTEGER NOT NULL DEFAULT 0",
);
asegurarColumna("cuentas", "voz_elevenlabs", "TEXT");
asegurarColumna(
  "conversaciones",
  "necesita_humano",
  "INTEGER NOT NULL DEFAULT 0",
);
asegurarColumna("mensajes", "tipo", "TEXT NOT NULL DEFAULT 'texto'");
asegurarColumna("mensajes", "media_path", "TEXT");
asegurarColumna(
  "bandeja_salida",
  "tipo",
  "TEXT NOT NULL DEFAULT 'texto'",
);
asegurarColumna("bandeja_salida", "media_path", "TEXT");

// ============================================================
// Auto-recuperación: si hay carpetas auth/{id}/ sin cuenta correspondiente,
// crear una cuenta automáticamente para preservar la sesión guardada.
// ============================================================
const directorioAuth = path.resolve(process.cwd(), "auth");
if (fs.existsSync(directorioAuth)) {
  const subcarpetas = fs
    .readdirSync(directorioAuth, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const nombre of subcarpetas) {
    const idCarpeta = parseInt(nombre, 10);
    if (!Number.isFinite(idCarpeta) || idCarpeta <= 0) continue;
    const yaExiste = db
      .prepare(`SELECT 1 FROM cuentas WHERE id = ?`)
      .get(idCarpeta);
    if (yaExiste) continue;
    db.prepare(
      `INSERT INTO cuentas (id, etiqueta, prompt_sistema) VALUES (?, ?, ?)`,
    ).run(idCarpeta, `Cuenta ${idCarpeta}`, PROMPT_SISTEMA_DEFAULT);
    console.log(
      `[baseDatos] Cuenta ${idCarpeta} reconstruida desde auth/${idCarpeta}/`,
    );
  }
}

// ============================================================
// Statements preparados
// ============================================================
const stmtBuscarCuentaPorId = db.prepare(`SELECT * FROM cuentas WHERE id = ?`);
const stmtListarCuentas = db.prepare(
  `SELECT * FROM cuentas WHERE esta_archivada = 0 ORDER BY creada_en ASC, id ASC`,
);
const stmtInsertarCuenta = db.prepare(
  `INSERT INTO cuentas (etiqueta, prompt_sistema, modelo) VALUES (?, ?, ?)`,
);
const stmtActualizarCuentaCampos = db.prepare(
  `UPDATE cuentas SET
     etiqueta = ?,
     prompt_sistema = ?,
     contexto_negocio = ?,
     buffer_segundos = ?,
     modelo = ?,
     voz_elevenlabs = ?,
     actualizada_en = unixepoch()
   WHERE id = ?`,
);
const stmtActualizarEstadoCuenta = db.prepare(
  `UPDATE cuentas SET estado = ?, actualizada_en = unixepoch() WHERE id = ?`,
);
const stmtActualizarTelefonoCuenta = db.prepare(
  `UPDATE cuentas SET telefono = ?, actualizada_en = unixepoch() WHERE id = ?`,
);
const stmtActualizarQRCuenta = db.prepare(
  `UPDATE cuentas SET cadena_qr = ?, actualizada_en = unixepoch() WHERE id = ?`,
);
const stmtActualizarHeartbeatCuenta = db.prepare(
  `UPDATE cuentas SET ultimo_heartbeat = ? WHERE id = ?`,
);
const stmtArchivarCuenta = db.prepare(
  `UPDATE cuentas SET esta_archivada = 1, esta_activa = 0, actualizada_en = unixepoch() WHERE id = ?`,
);

const stmtBuscarConversacionPorTelefono = db.prepare(
  `SELECT * FROM conversaciones WHERE cuenta_id = ? AND telefono = ?`,
);
const stmtBuscarConversacionPorId = db.prepare(
  `SELECT * FROM conversaciones WHERE id = ?`,
);
const stmtInsertarConversacion = db.prepare(
  `INSERT INTO conversaciones (cuenta_id, telefono, jid_wa, nombre) VALUES (?, ?, ?, ?)`,
);
const stmtActualizarNombre = db.prepare(
  `UPDATE conversaciones SET nombre = ? WHERE id = ? AND (nombre IS NULL OR nombre = '')`,
);
const stmtActualizarJid = db.prepare(
  `UPDATE conversaciones SET jid_wa = ? WHERE id = ?`,
);
const stmtActualizarUltimoMensaje = db.prepare(
  `UPDATE conversaciones SET ultimo_mensaje_en = ? WHERE id = ?`,
);
const stmtInsertarMensaje = db.prepare(
  `INSERT INTO mensajes (cuenta_id, conversacion_id, rol, tipo, contenido, media_path)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const stmtMarcarNecesitaHumano = db.prepare(
  `UPDATE conversaciones SET necesita_humano = ?, modo = ? WHERE id = ?`,
);
const stmtLimpiarNecesitaHumano = db.prepare(
  `UPDATE conversaciones SET necesita_humano = 0 WHERE id = ?`,
);
const stmtListarMensajes = db.prepare(
  `SELECT * FROM mensajes WHERE conversacion_id = ?
   ORDER BY creado_en ASC, id ASC LIMIT ?`,
);
const stmtHistorialReciente = db.prepare(
  `SELECT * FROM mensajes WHERE conversacion_id = ?
   ORDER BY creado_en DESC, id DESC LIMIT ?`,
);
const stmtCambiarModo = db.prepare(
  `UPDATE conversaciones SET modo = ? WHERE id = ?`,
);
const stmtListarConversaciones = db.prepare(`
  SELECT c.*,
    (
      SELECT contenido FROM mensajes m
      WHERE m.conversacion_id = c.id
      ORDER BY m.creado_en DESC, m.id DESC LIMIT 1
    ) AS vista_previa_ultimo_mensaje,
    COALESCE((
      SELECT json_group_array(
        json_object('id', e.id, 'nombre', e.nombre, 'color', e.color)
      )
      FROM etiquetas e
      JOIN conversacion_etiquetas ce ON ce.etiqueta_id = e.id
      WHERE ce.conversacion_id = c.id
      ORDER BY e.orden ASC, e.id ASC
    ), '[]') AS etiquetas_json
  FROM conversaciones c
  WHERE c.cuenta_id = ?
  ORDER BY COALESCE(c.ultimo_mensaje_en, c.creada_en) DESC
`);

const stmtEncolarBandeja = db.prepare(
  `INSERT INTO bandeja_salida
     (cuenta_id, conversacion_id, telefono, tipo, contenido, media_path)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const stmtPendientesBandejaDeCuenta = db.prepare(
  `SELECT * FROM bandeja_salida WHERE enviado = 0 AND cuenta_id = ?
   ORDER BY creado_en ASC, id ASC LIMIT ?`,
);
const stmtMarcarBandejaEnviado = db.prepare(
  `UPDATE bandeja_salida SET enviado = 1 WHERE id = ?`,
);

const stmtBorrarMensajesDeConversacion = db.prepare(
  `DELETE FROM mensajes WHERE conversacion_id = ?`,
);
const stmtBorrarBandejaPendienteDeConversacion = db.prepare(
  `DELETE FROM bandeja_salida WHERE conversacion_id = ? AND enviado = 0`,
);
const stmtBorrarConversacion = db.prepare(
  `DELETE FROM conversaciones WHERE id = ?`,
);

// ============================================================
// API pública: cuentas
// ============================================================
export function listarCuentas(): Cuenta[] {
  return stmtListarCuentas.all() as Cuenta[];
}

export function obtenerCuenta(id: number): Cuenta | null {
  return (stmtBuscarCuentaPorId.get(id) as Cuenta | undefined) ?? null;
}

export function crearCuenta(
  etiqueta: string,
  promptSistema?: string | null,
  modelo?: string | null,
): Cuenta {
  const prompt = promptSistema?.trim() || PROMPT_SISTEMA_DEFAULT;
  const info = stmtInsertarCuenta.run(etiqueta.trim(), prompt, modelo ?? null);
  return obtenerCuenta(Number(info.lastInsertRowid)) as Cuenta;
}

export function actualizarCuenta(
  id: number,
  parametros: {
    etiqueta?: string;
    prompt_sistema?: string;
    contexto_negocio?: string;
    buffer_segundos?: number;
    modelo?: string | null;
    voz_elevenlabs?: string | null;
  },
): Cuenta | null {
  const actual = obtenerCuenta(id);
  if (!actual) return null;
  const etiqueta = parametros.etiqueta?.trim() || actual.etiqueta;
  const prompt =
    parametros.prompt_sistema !== undefined
      ? parametros.prompt_sistema
      : actual.prompt_sistema;
  const contexto =
    parametros.contexto_negocio !== undefined
      ? parametros.contexto_negocio
      : actual.contexto_negocio;
  const buffer =
    parametros.buffer_segundos !== undefined
      ? Math.max(0, Math.min(120, Math.floor(parametros.buffer_segundos)))
      : actual.buffer_segundos;
  const modelo =
    parametros.modelo === undefined ? actual.modelo : parametros.modelo;
  const voz =
    parametros.voz_elevenlabs === undefined
      ? actual.voz_elevenlabs
      : parametros.voz_elevenlabs;
  stmtActualizarCuentaCampos.run(
    etiqueta,
    prompt,
    contexto,
    buffer,
    modelo,
    voz,
    id,
  );
  return obtenerCuenta(id);
}

export function archivarCuenta(id: number): void {
  stmtArchivarCuenta.run(id);
}

export function actualizarEstadoCuenta(
  id: number,
  parametros: {
    estado: EstadoConexion;
    cadena_qr?: string | null;
    telefono?: string | null;
  },
): void {
  stmtActualizarEstadoCuenta.run(parametros.estado, id);
  if (Object.prototype.hasOwnProperty.call(parametros, "cadena_qr")) {
    stmtActualizarQRCuenta.run(parametros.cadena_qr ?? null, id);
  }
  if (Object.prototype.hasOwnProperty.call(parametros, "telefono")) {
    stmtActualizarTelefonoCuenta.run(parametros.telefono ?? null, id);
  }
}

export function actualizarHeartbeatCuenta(id: number): void {
  stmtActualizarHeartbeatCuenta.run(Math.floor(Date.now() / 1000), id);
}

// ============================================================
// API pública: conversaciones
// ============================================================
export function obtenerOCrearConversacion(
  cuentaId: number,
  telefono: string,
  nombre?: string | null,
  jidWa?: string | null,
): Conversacion {
  const existente = stmtBuscarConversacionPorTelefono.get(
    cuentaId,
    telefono,
  ) as Conversacion | undefined;
  if (existente) {
    if (nombre && (!existente.nombre || existente.nombre === "")) {
      stmtActualizarNombre.run(nombre, existente.id);
      existente.nombre = nombre;
    }
    if (jidWa && existente.jid_wa !== jidWa) {
      stmtActualizarJid.run(jidWa, existente.id);
      existente.jid_wa = jidWa;
    }
    return existente;
  }
  const info = stmtInsertarConversacion.run(
    cuentaId,
    telefono,
    jidWa ?? null,
    nombre ?? null,
  );
  return stmtBuscarConversacionPorId.get(info.lastInsertRowid) as Conversacion;
}

export function obtenerConversacionPorId(id: number): Conversacion | null {
  return (
    (stmtBuscarConversacionPorId.get(id) as Conversacion | undefined) ?? null
  );
}

interface FilaConversacionListado extends Conversacion {
  vista_previa_ultimo_mensaje: string | null;
  etiquetas_json: string;
}

export function listarConversaciones(
  cuentaId: number,
): ConversacionConPreview[] {
  const filas = stmtListarConversaciones.all(
    cuentaId,
  ) as FilaConversacionListado[];
  return filas.map((f) => {
    let etiquetas: EtiquetaResumen[] = [];
    try {
      etiquetas = JSON.parse(f.etiquetas_json) as EtiquetaResumen[];
    } catch {
      etiquetas = [];
    }
    const { etiquetas_json: _omitido, ...rest } = f;
    void _omitido;
    return { ...rest, etiquetas } as ConversacionConPreview;
  });
}

const transaccionInsertarMensaje = db.transaction(
  (
    cuentaId: number,
    conversacionId: number,
    rol: RolMensaje,
    tipo: TipoMensaje,
    contenido: string,
    mediaPath: string | null,
  ) => {
    stmtInsertarMensaje.run(
      cuentaId,
      conversacionId,
      rol,
      tipo,
      contenido,
      mediaPath,
    );
    stmtActualizarUltimoMensaje.run(
      Math.floor(Date.now() / 1000),
      conversacionId,
    );
  },
);

export function insertarMensaje(
  cuentaId: number,
  conversacionId: number,
  rol: RolMensaje,
  contenido: string,
  opciones?: { tipo?: TipoMensaje; media_path?: string | null },
): void {
  const tipo = opciones?.tipo ?? "texto";
  const mediaPath = opciones?.media_path ?? null;
  transaccionInsertarMensaje(
    cuentaId,
    conversacionId,
    rol,
    tipo,
    contenido,
    mediaPath,
  );
}

export function marcarConversacionNecesitaHumano(
  conversacionId: number,
  razon: string,
): void {
  // Cambiar modo a HUMANO para que el bot deje de responder automáticamente
  // y marcar el flag para que el panel destaque la conversación.
  stmtMarcarNecesitaHumano.run(1, "HUMANO", conversacionId);
  insertarMensaje(
    // necesitamos conocer cuenta_id; hacemos un select rápido
    (stmtBuscarConversacionPorId.get(conversacionId) as Conversacion)
      .cuenta_id,
    conversacionId,
    "sistema",
    `🤝 Transferido a humano. Razón: ${razon}`,
    { tipo: "sistema" },
  );
}

export function limpiarNecesitaHumano(conversacionId: number): void {
  stmtLimpiarNecesitaHumano.run(conversacionId);
}

export function obtenerMensajes(
  conversacionId: number,
  limite = 200,
): Mensaje[] {
  return stmtListarMensajes.all(conversacionId, limite) as Mensaje[];
}

export function obtenerHistorialReciente(
  conversacionId: number,
  limite = 20,
): Mensaje[] {
  const filas = stmtHistorialReciente.all(conversacionId, limite) as Mensaje[];
  return filas.reverse();
}

export function cambiarModo(
  conversacionId: number,
  modo: ModoConversacion,
): void {
  stmtCambiarModo.run(modo, conversacionId);
  // Si el usuario manualmente vuelve a IA, limpiar el flag de "necesita humano"
  if (modo === "IA") {
    stmtLimpiarNecesitaHumano.run(conversacionId);
  }
}

const transaccionBorrarConversacion = db.transaction((id: number) => {
  stmtBorrarMensajesDeConversacion.run(id);
  stmtBorrarBandejaPendienteDeConversacion.run(id);
  stmtBorrarConversacion.run(id);
});

export function borrarConversacion(id: number): void {
  transaccionBorrarConversacion(id);
}

// ============================================================
// API pública: bandeja de salida
// ============================================================
export function encolarBandejaSalida(
  cuentaId: number,
  conversacionId: number,
  telefono: string,
  contenido: string,
  opciones?: { tipo?: TipoMensaje; media_path?: string | null },
): number {
  const tipo = opciones?.tipo ?? "texto";
  const mediaPath = opciones?.media_path ?? null;
  const info = stmtEncolarBandeja.run(
    cuentaId,
    conversacionId,
    telefono,
    tipo,
    contenido,
    mediaPath,
  );
  return Number(info.lastInsertRowid);
}

export function obtenerPendientesBandejaDeCuenta(
  cuentaId: number,
  limite = 20,
): FilaBandejaSalida[] {
  return stmtPendientesBandejaDeCuenta.all(
    cuentaId,
    limite,
  ) as FilaBandejaSalida[];
}

export function marcarBandejaEnviado(id: number): void {
  stmtMarcarBandejaEnviado.run(id);
}

// ============================================================
// API pública: conocimiento (entradas estructuradas por cuenta)
// ============================================================
const stmtListarConocimiento = db.prepare(
  `SELECT * FROM conocimiento WHERE cuenta_id = ? ORDER BY orden ASC, id ASC`,
);
const stmtObtenerEntrada = db.prepare(
  `SELECT * FROM conocimiento WHERE id = ?`,
);
const stmtMaxOrden = db.prepare(
  `SELECT COALESCE(MAX(orden), -1) AS max_orden FROM conocimiento WHERE cuenta_id = ?`,
);
const stmtInsertarEntrada = db.prepare(
  `INSERT INTO conocimiento (cuenta_id, titulo, contenido, orden) VALUES (?, ?, ?, ?)`,
);
const stmtActualizarEntrada = db.prepare(
  `UPDATE conocimiento SET titulo = ?, contenido = ?, actualizada_en = unixepoch() WHERE id = ?`,
);
const stmtActualizarOrdenEntrada = db.prepare(
  `UPDATE conocimiento SET orden = ? WHERE id = ?`,
);
const stmtBorrarEntrada = db.prepare(
  `DELETE FROM conocimiento WHERE id = ?`,
);
const stmtBorrarConocimientoDeCuenta = db.prepare(
  `DELETE FROM conocimiento WHERE cuenta_id = ?`,
);

export function listarConocimientoDeCuenta(
  cuentaId: number,
): EntradaConocimiento[] {
  return stmtListarConocimiento.all(cuentaId) as EntradaConocimiento[];
}

export function obtenerEntradaConocimiento(
  id: number,
): EntradaConocimiento | null {
  return (
    (stmtObtenerEntrada.get(id) as EntradaConocimiento | undefined) ?? null
  );
}

export function crearEntradaConocimiento(
  cuentaId: number,
  titulo: string,
  contenido: string,
): EntradaConocimiento {
  const fila = stmtMaxOrden.get(cuentaId) as { max_orden: number };
  const ordenSiguiente = (fila?.max_orden ?? -1) + 1;
  const info = stmtInsertarEntrada.run(
    cuentaId,
    titulo.trim(),
    contenido,
    ordenSiguiente,
  );
  return obtenerEntradaConocimiento(
    Number(info.lastInsertRowid),
  ) as EntradaConocimiento;
}

export function actualizarEntradaConocimiento(
  id: number,
  parametros: { titulo?: string; contenido?: string; orden?: number },
): EntradaConocimiento | null {
  const actual = obtenerEntradaConocimiento(id);
  if (!actual) return null;
  if (parametros.titulo !== undefined || parametros.contenido !== undefined) {
    const titulo = parametros.titulo?.trim() || actual.titulo;
    const contenido =
      parametros.contenido !== undefined
        ? parametros.contenido
        : actual.contenido;
    stmtActualizarEntrada.run(titulo, contenido, id);
  }
  if (parametros.orden !== undefined) {
    stmtActualizarOrdenEntrada.run(parametros.orden, id);
  }
  return obtenerEntradaConocimiento(id);
}

export function borrarEntradaConocimiento(id: number): void {
  stmtBorrarEntrada.run(id);
}

export function borrarConocimientoDeCuenta(cuentaId: number): void {
  stmtBorrarConocimientoDeCuenta.run(cuentaId);
}

// ============================================================
// API pública: respuestas rápidas (templates de texto por cuenta)
// ============================================================
const stmtListarRespuestasRapidas = db.prepare(
  `SELECT * FROM respuestas_rapidas WHERE cuenta_id = ? ORDER BY orden ASC, id ASC`,
);
const stmtObtenerRespuestaRapida = db.prepare(
  `SELECT * FROM respuestas_rapidas WHERE id = ?`,
);
const stmtMaxOrdenRR = db.prepare(
  `SELECT COALESCE(MAX(orden), -1) AS max_orden FROM respuestas_rapidas WHERE cuenta_id = ?`,
);
const stmtInsertarRespuestaRapida = db.prepare(
  `INSERT INTO respuestas_rapidas (cuenta_id, atajo, texto, orden) VALUES (?, ?, ?, ?)`,
);
const stmtActualizarRespuestaRapida = db.prepare(
  `UPDATE respuestas_rapidas SET atajo = ?, texto = ?, actualizada_en = unixepoch() WHERE id = ?`,
);
const stmtBorrarRespuestaRapida = db.prepare(
  `DELETE FROM respuestas_rapidas WHERE id = ?`,
);

export function listarRespuestasRapidas(cuentaId: number): RespuestaRapida[] {
  return stmtListarRespuestasRapidas.all(cuentaId) as RespuestaRapida[];
}

export function obtenerRespuestaRapida(id: number): RespuestaRapida | null {
  return (
    (stmtObtenerRespuestaRapida.get(id) as RespuestaRapida | undefined) ?? null
  );
}

export function crearRespuestaRapida(
  cuentaId: number,
  atajo: string,
  texto: string,
): RespuestaRapida {
  const fila = stmtMaxOrdenRR.get(cuentaId) as { max_orden: number };
  const orden = (fila?.max_orden ?? -1) + 1;
  const info = stmtInsertarRespuestaRapida.run(
    cuentaId,
    atajo.trim(),
    texto,
    orden,
  );
  return obtenerRespuestaRapida(
    Number(info.lastInsertRowid),
  ) as RespuestaRapida;
}

export function actualizarRespuestaRapida(
  id: number,
  parametros: { atajo?: string; texto?: string },
): RespuestaRapida | null {
  const actual = obtenerRespuestaRapida(id);
  if (!actual) return null;
  const atajo = parametros.atajo?.trim() || actual.atajo;
  const texto =
    parametros.texto !== undefined ? parametros.texto : actual.texto;
  stmtActualizarRespuestaRapida.run(atajo, texto, id);
  return obtenerRespuestaRapida(id);
}

export function borrarRespuestaRapida(id: number): void {
  stmtBorrarRespuestaRapida.run(id);
}

// ============================================================
// API pública: etiquetas (tags) por cuenta
// ============================================================
const stmtListarEtiquetas = db.prepare(
  `SELECT * FROM etiquetas WHERE cuenta_id = ? ORDER BY orden ASC, id ASC`,
);
const stmtObtenerEtiqueta = db.prepare(
  `SELECT * FROM etiquetas WHERE id = ?`,
);
const stmtMaxOrdenEtiqueta = db.prepare(
  `SELECT COALESCE(MAX(orden), -1) AS m FROM etiquetas WHERE cuenta_id = ?`,
);
const stmtInsertarEtiqueta = db.prepare(
  `INSERT INTO etiquetas (cuenta_id, nombre, color, descripcion, orden)
   VALUES (?, ?, ?, ?, ?)`,
);
const stmtActualizarEtiqueta = db.prepare(
  `UPDATE etiquetas SET nombre = ?, color = ?, descripcion = ? WHERE id = ?`,
);
const stmtBorrarEtiqueta = db.prepare(`DELETE FROM etiquetas WHERE id = ?`);
const stmtBorrarAsignacionesDeEtiqueta = db.prepare(
  `DELETE FROM conversacion_etiquetas WHERE etiqueta_id = ?`,
);

const stmtAsignarEtiqueta = db.prepare(
  `INSERT OR IGNORE INTO conversacion_etiquetas (conversacion_id, etiqueta_id) VALUES (?, ?)`,
);
const stmtQuitarEtiqueta = db.prepare(
  `DELETE FROM conversacion_etiquetas WHERE conversacion_id = ? AND etiqueta_id = ?`,
);
const stmtEtiquetasDeConversacion = db.prepare(
  `SELECT e.* FROM etiquetas e
   JOIN conversacion_etiquetas ce ON ce.etiqueta_id = e.id
   WHERE ce.conversacion_id = ?
   ORDER BY e.orden ASC, e.id ASC`,
);
const stmtEtiquetasDeCuentaConCount = db.prepare(`
  SELECT e.*, (
    SELECT COUNT(*) FROM conversacion_etiquetas ce
    JOIN conversaciones c ON c.id = ce.conversacion_id
    WHERE ce.etiqueta_id = e.id AND c.cuenta_id = e.cuenta_id
  ) AS total_conversaciones
  FROM etiquetas e
  WHERE e.cuenta_id = ?
  ORDER BY e.orden ASC, e.id ASC
`);

export function listarEtiquetas(cuentaId: number): Etiqueta[] {
  return stmtListarEtiquetas.all(cuentaId) as Etiqueta[];
}

export interface EtiquetaConCount extends Etiqueta {
  total_conversaciones: number;
}

export function listarEtiquetasConCount(cuentaId: number): EtiquetaConCount[] {
  return stmtEtiquetasDeCuentaConCount.all(cuentaId) as EtiquetaConCount[];
}

export function obtenerEtiqueta(id: number): Etiqueta | null {
  return (stmtObtenerEtiqueta.get(id) as Etiqueta | undefined) ?? null;
}

export function crearEtiqueta(
  cuentaId: number,
  nombre: string,
  color: string,
  descripcion?: string | null,
): Etiqueta {
  const fila = stmtMaxOrdenEtiqueta.get(cuentaId) as { m: number };
  const orden = (fila?.m ?? -1) + 1;
  const info = stmtInsertarEtiqueta.run(
    cuentaId,
    nombre.trim(),
    color,
    descripcion ?? null,
    orden,
  );
  return obtenerEtiqueta(Number(info.lastInsertRowid)) as Etiqueta;
}

export function actualizarEtiqueta(
  id: number,
  parametros: { nombre?: string; color?: string; descripcion?: string | null },
): Etiqueta | null {
  const actual = obtenerEtiqueta(id);
  if (!actual) return null;
  const nombre = parametros.nombre?.trim() || actual.nombre;
  const color = parametros.color || actual.color;
  const descripcion =
    parametros.descripcion !== undefined
      ? parametros.descripcion
      : actual.descripcion;
  stmtActualizarEtiqueta.run(nombre, color, descripcion, id);
  return obtenerEtiqueta(id);
}

const transaccionBorrarEtiqueta = db.transaction((id: number) => {
  stmtBorrarAsignacionesDeEtiqueta.run(id);
  stmtBorrarEtiqueta.run(id);
});

export function borrarEtiqueta(id: number): void {
  transaccionBorrarEtiqueta(id);
}

export function asignarEtiquetaAConversacion(
  conversacionId: number,
  etiquetaId: number,
): void {
  stmtAsignarEtiqueta.run(conversacionId, etiquetaId);
}

export function quitarEtiquetaDeConversacion(
  conversacionId: number,
  etiquetaId: number,
): void {
  stmtQuitarEtiqueta.run(conversacionId, etiquetaId);
}

export function obtenerEtiquetasDeConversacion(
  conversacionId: number,
): Etiqueta[] {
  return stmtEtiquetasDeConversacion.all(conversacionId) as Etiqueta[];
}

// ============================================================
// API pública: biblioteca de medios reutilizables por cuenta
// ============================================================
const stmtListarBiblioteca = db.prepare(
  `SELECT * FROM biblioteca_medios WHERE cuenta_id = ? ORDER BY id DESC`,
);
const stmtObtenerMedioBiblioteca = db.prepare(
  `SELECT * FROM biblioteca_medios WHERE id = ?`,
);
const stmtObtenerMedioPorIdentificador = db.prepare(
  `SELECT * FROM biblioteca_medios WHERE cuenta_id = ? AND identificador = ?`,
);
const stmtInsertarMedioBiblioteca = db.prepare(
  `INSERT INTO biblioteca_medios (cuenta_id, identificador, tipo, ruta_archivo, descripcion)
   VALUES (?, ?, ?, ?, ?)`,
);
const stmtActualizarDescripcionMedio = db.prepare(
  `UPDATE biblioteca_medios SET descripcion = ? WHERE id = ?`,
);
const stmtBorrarMedioBiblioteca = db.prepare(
  `DELETE FROM biblioteca_medios WHERE id = ?`,
);

export function listarBiblioteca(cuentaId: number): MedioBiblioteca[] {
  return stmtListarBiblioteca.all(cuentaId) as MedioBiblioteca[];
}

export function obtenerMedioBiblioteca(id: number): MedioBiblioteca | null {
  return (
    (stmtObtenerMedioBiblioteca.get(id) as MedioBiblioteca | undefined) ?? null
  );
}

export function obtenerMedioPorIdentificador(
  cuentaId: number,
  identificador: string,
): MedioBiblioteca | null {
  return (
    (stmtObtenerMedioPorIdentificador.get(cuentaId, identificador) as
      | MedioBiblioteca
      | undefined) ?? null
  );
}

export function crearMedioBiblioteca(
  cuentaId: number,
  identificador: string,
  tipo: TipoMediaBiblioteca,
  rutaArchivo: string,
  descripcion: string,
): MedioBiblioteca {
  const info = stmtInsertarMedioBiblioteca.run(
    cuentaId,
    identificador,
    tipo,
    rutaArchivo,
    descripcion,
  );
  return obtenerMedioBiblioteca(
    Number(info.lastInsertRowid),
  ) as MedioBiblioteca;
}

export function actualizarDescripcionMedio(
  id: number,
  descripcion: string,
): MedioBiblioteca | null {
  stmtActualizarDescripcionMedio.run(descripcion, id);
  return obtenerMedioBiblioteca(id);
}

export function borrarMedioBiblioteca(id: number): void {
  stmtBorrarMedioBiblioteca.run(id);
}

export default db;
