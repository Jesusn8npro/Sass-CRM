import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  type WAMessageKey,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import {
  actualizarEstadoCuenta,
  listarCuentas,
  obtenerCuenta,
  type Cuenta,
} from "../baseDatos";
import {
  procesarBandejaSalidaDeCuenta,
  registrarManejadores,
} from "./manejador";
import {
  borrarSesionBaileysDeCuenta,
  useSupabaseAuthState,
} from "./auth-supabase";
import { notificarCuentaDesconectada } from "../notificaciones";
import { enviarWhatsAppCaido } from "../emails/disparadores";

interface ErrorConCodigo {
  output?: { statusCode?: number };
  statusCode?: number;
}

interface SocketCuenta {
  cuentaId: string;
  etiqueta: string;
  sock: WASocket;
  temporizadorReconexion: NodeJS.Timeout | null;
  /**
   * Caché de mensajes enviados — Baileys la consulta por `getMessage`
   * cuando WhatsApp pide reupload de media (sin esto el receptor ve
   * "este audio ya no está disponible"). Bounded a 500 entradas LRU.
   */
  mensajesEnviados: Map<string, proto.IMessage>;
  /**
   * Timestamps de códigos 440 recientes. Si hay > UMBRAL_CONFLICTO440
   * en menos de VENTANA_CONFLICTO_MS, asumimos que otro proceso está
   * compitiendo por la misma sesión y pausamos por TIEMPO_PAUSA_CONFLICTO.
   */
  timestamps440: number[];
  /** Si > 0, el gestor NO intenta reconectar hasta esta timestamp. */
  pausarReconexionHasta: number;
}

// Detección de conflicto multi-instancia. 2 closes en 20s ya es
// señal clara de que algo compite por la sesión — pausamos rápido
// para no spamear el terminal.
const UMBRAL_CONFLICTO440 = 2;
const VENTANA_CONFLICTO_MS = 20_000;
const TIEMPO_PAUSA_CONFLICTO_MS = 15 * 60_000; // 15 minutos

const MAX_MENSAJES_CACHE = 500;

function recordarMensaje(
  entrada: SocketCuenta,
  id: string | null | undefined,
  mensaje: proto.IMessage | null | undefined,
): void {
  if (!id || !mensaje) return;
  const cache = entrada.mensajesEnviados;
  // LRU simple: si ya existe, lo movemos al final reinsertando.
  if (cache.has(id)) cache.delete(id);
  cache.set(id, mensaje);
  while (cache.size > MAX_MENSAJES_CACHE) {
    const primero = cache.keys().next().value;
    if (primero === undefined) break;
    cache.delete(primero);
  }
}

const logger = pino({ level: "silent" });

function extraerTelefonoDeJID(jid: string | undefined): string | null {
  if (!jid) return null;
  const sinSufijo = jid.split("@")[0];
  if (!sinSufijo) return null;
  const sinDispositivo = sinSufijo.split(":")[0];
  return sinDispositivo || null;
}

class GestorCuentas {
  private sockets = new Map<string, SocketCuenta>();
  private detenido = false;
  /**
   * Cuentas pausadas por conflicto detectado. Si el timestamp es
   * futuro, sincronizar NO arranca el socket. Una vez que pasa, se
   * limpia automaticamente.
   */
  private pausasPorConflicto = new Map<string, number>();
  /**
   * Cuentas que el usuario desconectó a propósito (con logout). Sirve para
   * que el handler de 'loggedOut' NO mande falsas alertas de "cuenta caída"
   * cuando el cierre fue intencional.
   */
  private cierresIntencionales = new Set<string>();

  /** Cuentas cuya bandeja de salida se está procesando ahora mismo. */
  private bandejasEnCurso = new Set<string>();

  async iniciar(): Promise<void> {
    await this.sincronizar();
  }

  async sincronizar(): Promise<void> {
    if (this.detenido) return;
    const todas = await listarCuentas();
    const cuentas = todas.filter(
      (c) => c.esta_activa && !c.esta_archivada,
    );
    const idsActivos = new Set(cuentas.map((c) => c.id));

    // Apagar sockets de cuentas que ya no están activas
    for (const [id, entrada] of this.sockets) {
      if (!idsActivos.has(id)) {
        console.log(`[gestor] Apagando cuenta ${id} (${entrada.etiqueta})`);
        await this.apagarSocket(id);
      }
    }

    // Iniciar sockets para cuentas nuevas, respetando pausa por conflicto
    const ahora = Date.now();
    for (const cuenta of cuentas) {
      if (this.sockets.has(cuenta.id)) continue;

      // Si hay pausa por conflicto activa, skip.
      const pausaHasta = this.pausasPorConflicto.get(cuenta.id) ?? 0;
      if (pausaHasta > ahora) continue;
      if (pausaHasta > 0 && pausaHasta <= ahora) {
        // Pausa expiró — limpiar y volver a intentar normalmente
        this.pausasPorConflicto.delete(cuenta.id);
        console.log(
          `[gestor] pausa por conflicto expiró para cuenta ${cuenta.id} — reintentando`,
        );
      }

      try {
        await this.iniciarSocketCuenta(cuenta);
      } catch (err) {
        console.error(
          `[gestor] Error iniciando socket cuenta ${cuenta.id}:`,
          err,
        );
      }
    }
  }

  private async iniciarSocketCuenta(cuenta: Cuenta): Promise<void> {
    // Sesión persistida en Supabase Postgres (no más disco local).
    // Sobrevive reinicios y permite multi-instancia del bot.
    const { state, saveCreds } = await useSupabaseAuthState(cuenta.id);

    let version: [number, number, number] | undefined;
    try {
      const obtenida = await fetchLatestBaileysVersion();
      version = obtenida.version;
    } catch {
      // ignorar, se usa la versión default
    }

    const estadoActual = await obtenerCuenta(cuenta.id);
    if (estadoActual && estadoActual.estado === "desconectado") {
      await actualizarEstadoCuenta(cuenta.id, { estado: "conectando" });
    }

    // Inicializamos la caché ANTES de makeWASocket porque getMessage
    // (callback que Baileys invoca para retries de media) la consulta.
    const mensajesEnviados = new Map<string, proto.IMessage>();

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      // markOnlineOnConnect=true es necesario para que el indicador
      // "escribiendo..." funcione: WhatsApp solo lo muestra cuando
      // estamos online ante el contacto.
      markOnlineOnConnect: true,
      // EN false A PROPÓSITO. Con `true`, WhatsApp corta el handshake con
      // código 428 ("Connection Terminated") ANTES de emitir el QR, así que la
      // cuenta no se podía vincular: quedaba en bucle de reconexión infinito.
      //
      // Verificado aislando la opción contra Baileys puro, sin nada de la app:
      //   syncFullHistory:true      -> 428, sin QR
      //   markOnlineOnConnect:true  -> QR OK
      //   getMessage                -> QR OK
      //
      // El costo es que al vincular ya no llega el historial previo (varios
      // meses) por 'messaging-history.set': solo se ven las conversaciones
      // nuevas. Es el precio de poder conectar. Si WhatsApp vuelve a aceptarlo,
      // reactivar y re-verificar con el mismo test antes de subirlo.
      syncFullHistory: false,
      // Sin esto, cuando el receptor pide reupload de un audio/imagen
      // después de unos minutos, Baileys responde null y WhatsApp
      // muestra "este audio ya no está disponible". Devolviendo el
      // mensaje cacheado, Baileys re-sube la media correctamente.
      getMessage: async (
        key: WAMessageKey,
      ): Promise<proto.IMessage | undefined> => {
        if (!key.id) return undefined;
        return mensajesEnviados.get(key.id);
      },
    });

    // Preservar el tracking de 440 si la cuenta se estaba reconectando
    const previo = this.sockets.get(cuenta.id);
    const entrada: SocketCuenta = {
      cuentaId: cuenta.id,
      etiqueta: cuenta.etiqueta,
      sock,
      temporizadorReconexion: null,
      mensajesEnviados,
      timestamps440: previo?.timestamps440 ?? [],
      pausarReconexionHasta: previo?.pausarReconexionHasta ?? 0,
    };
    this.sockets.set(cuenta.id, entrada);

    // Capturamos cada mensaje que sale de este socket para tenerlo
    // disponible si WhatsApp pide reupload luego.
    sock.ev.on("messages.upsert", ({ messages }) => {
      for (const m of messages) {
        if (m.key.fromMe && m.key.id && m.message) {
          recordarMensaje(entrada, m.key.id, m.message);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    const prefijo = `[bot:${cuenta.etiqueta}]`;

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`${prefijo} QR generado, esperando escaneo...`);
        qrcodeTerminal.generate(qr, { small: true });
        void actualizarEstadoCuenta(cuenta.id, {
          estado: "qr",
          cadena_qr: qr,
          telefono: null,
        });
        return;
      }

      if (connection === "connecting") {
        void (async () => {
          const actual = await obtenerCuenta(cuenta.id);
          if (actual && actual.estado === "desconectado") {
            await actualizarEstadoCuenta(cuenta.id, { estado: "conectando" });
          }
        })();
        return;
      }

      if (connection === "open") {
        const telefono = extraerTelefonoDeJID(sock.user?.id);
        // Anti-flap: solo loggear "conectado" si NO hubo desconexiones
        // recientes (< 30s). Si el bot está flapping, los logs no aportan.
        const entradaActual = this.sockets.get(cuenta.id);
        const ahora = Date.now();
        const huboCierreReciente =
          entradaActual?.timestamps440.some((t) => ahora - t < 30_000) ??
          false;
        if (!huboCierreReciente) {
          console.log(
            `${prefijo} ✓ conectado al número ${telefono ?? "?"}`,
          );
        }
        void actualizarEstadoCuenta(cuenta.id, {
          estado: "conectado",
          cadena_qr: null,
          telefono,
        });
        // Anunciar disponibilidad para que el indicador "escribiendo..."
        // sea visible a los contactos.
        sock.sendPresenceUpdate("available").catch(() => {});
        return;
      }

      if (connection === "close") {
        const error = lastDisconnect?.error as ErrorConCodigo | undefined;
        const codigo = error?.output?.statusCode ?? error?.statusCode;
        // No loggear el close ruidoso aca — programarReconexion va a
        // emitir un mensaje compacto de "reintentando" o el banner
        // de conflicto detectado si llega al umbral.

        if (codigo === DisconnectReason.loggedOut) {
          // ¿El usuario lo desconectó a propósito? Entonces no son alertas
          // reales — saltamos las notificaciones de "cuenta caída".
          const intencional = this.cierresIntencionales.has(cuenta.id);
          this.cierresIntencionales.delete(cuenta.id);
          console.log(
            `${prefijo} sesión cerrada${intencional ? " (intencional)" : " por WhatsApp"}. Limpiando creds.`,
          );
          // Log admin: loggedOut es crítico (cuenta sale de servicio
          // hasta que el dueño escanee QR de nuevo). Solo si NO fue intencional.
          if (!intencional) {
            void (async () => {
              try {
                const { registrarEvento } = await import("../db/eventosLog");
                registrarEvento({
                  cuentaId: cuenta.id,
                  nivel: "critical",
                  contexto: "baileys.gestor.loggedOut",
                  mensaje: `Sesión WhatsApp cerrada (código ${codigo}). Requiere re-escaneo de QR.`,
                  metadata: { etiqueta: cuenta.etiqueta, codigo },
                });
              } catch {
                /* ignorar */
              }
            })();
          }
          void actualizarEstadoCuenta(cuenta.id, {
            estado: "desconectado",
            cadena_qr: null,
            telefono: null,
          });
          // Borrar la sesión de Supabase para que el siguiente arranque
          // genere QR limpio.
          void borrarSesionBaileysDeCuenta(cuenta.id).catch(() => {});
          if (!intencional) {
            // Notificar al dueño (in-app + email si está Resend).
            void notificarCuentaDesconectada(
              cuenta.id,
              cuenta.etiqueta,
              `WhatsApp cerró la sesión (código ${DisconnectReason.loggedOut}). Posibles causas: superaste 4 dispositivos vinculados, 14+ días sin abrir WhatsApp en el móvil, o cerraste sesión manualmente desde "Dispositivos vinculados".`,
            ).catch((err) => {
              console.error(`${prefijo} error notificando desconexión:`, err);
            });
            // Email transaccional dedicado de WhatsApp caído (fire-and-forget).
            void enviarWhatsAppCaido(cuenta.id);
          }
          // Sacar el socket del Map con un tick de diferencia para no
          // re-entrar en el mismo event handler. sincronizar() lo va a
          // crear de cero en el próximo ciclo (3s) y generará QR nuevo.
          setTimeout(() => { this.sockets.delete(cuenta.id); }, 200);
          return;
        }

        this.programarReconexion(cuenta.id, codigo);
      }
    });

    registrarManejadores(sock, cuenta.id, cuenta.etiqueta);
  }

  private programarReconexion(
    cuentaId: string,
    codigo: number | undefined,
  ): void {
    const entrada = this.sockets.get(cuentaId);
    if (!entrada) return;
    if (entrada.temporizadorReconexion) return;

    // Detección de conflicto multi-proceso: si el socket se cierra
    // rapido varias veces, casi seguro hay otra instancia del bot
    // compitiendo. Pausamos.
    //
    // El 428 (connectionClosed) queda FUERA del conteo. Es un cierre normal del
    // socket —la doc de Baileys dice que se puede reconectar sin más— y no
    // implica que haya otra instancia. Contándolo, dos cierres benignos en 20s
    // pausaban la cuenta 15 minutos, y durante la pausa `sincronizar()` la
    // saltea: el QR no llegaba a emitirse nunca, ni en local ni en producción.
    const ahora = Date.now();
    if (codigo !== 428) entrada.timestamps440.push(ahora);
    entrada.timestamps440 = entrada.timestamps440.filter(
      (t) => ahora - t < VENTANA_CONFLICTO_MS,
    );
    if (entrada.timestamps440.length >= UMBRAL_CONFLICTO440) {
      entrada.pausarReconexionHasta = ahora + TIEMPO_PAUSA_CONFLICTO_MS;
      entrada.timestamps440 = [];
      console.warn(
        `\n[bot:${entrada.etiqueta}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}] ⚠ CONFLICTO DETECTADO`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}]   ${UMBRAL_CONFLICTO440}+ desconexiones en ${VENTANA_CONFLICTO_MS / 1000}s.`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}]   Probable: otra instancia del bot corre con la misma sesion`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}]   (ej: Easy Panel produccion + npm run dev local).`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}]   Solucion: agrega BOT_ENABLED=false en .env.local del entorno`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}]   donde NO queres que arranque el bot, y reinicia.`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}] ⏸ Reconexion pausada ${TIEMPO_PAUSA_CONFLICTO_MS / 60000} minutos.`,
      );
      console.warn(
        `[bot:${entrada.etiqueta}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
      );
      void actualizarEstadoCuenta(cuentaId, {
        estado: "desconectado",
        cadena_qr: null,
      });
      // Log admin: conflicto multi-instancia es crítico (cuenta fuera 15min).
      void (async () => {
        try {
          const { registrarEvento } = await import("../db/eventosLog");
          registrarEvento({
            cuentaId,
            nivel: "critical",
            contexto: "baileys.gestor.conflicto440",
            mensaje: `Conflicto multi-instancia detectado: ${UMBRAL_CONFLICTO440}+ desconexiones en ${VENTANA_CONFLICTO_MS / 1000}s. Reconexión pausada ${TIEMPO_PAUSA_CONFLICTO_MS / 60000} min.`,
            metadata: {
              etiqueta: entrada.etiqueta,
              umbral: UMBRAL_CONFLICTO440,
              ventana_ms: VENTANA_CONFLICTO_MS,
              pausa_ms: TIEMPO_PAUSA_CONFLICTO_MS,
            },
          });
        } catch {
          /* ignorar */
        }
      })();
      // Email transaccional al dueño: la cuenta queda fuera 15min, vale avisar.
      void enviarWhatsAppCaido(cuentaId);
      // Registramos la pausa en el map dedicado y limpiamos el socket.
      // Sincronizar ya no va a re-iniciar hasta que pase pausarHasta.
      this.pausasPorConflicto.set(
        cuentaId,
        ahora + TIEMPO_PAUSA_CONFLICTO_MS,
      );
      void this.apagarSocket(cuentaId);
      return; // No programar reconexion
    }

    if (entrada.pausarReconexionHasta > ahora) {
      const minutosRestantes = Math.ceil(
        (entrada.pausarReconexionHasta - ahora) / 60000,
      );
      console.log(
        `[bot:${entrada.etiqueta}] ⏸ reconexion pausada (faltan ${minutosRestantes}min por conflicto detectado)`,
      );
      return;
    }

    const espera = codigo === 440 ? 4000 : 5000;
    // Solo loggear UNA vez al inicio del ciclo (no en cada reintento).
    // Si esta en loop, el banner de conflicto va a aparecer pronto.
    if (entrada.timestamps440.length === 1) {
      console.log(
        `[bot:${entrada.etiqueta}] desconectado (codigo ${codigo ?? "?"}). Reintentando...`,
      );
    }
    entrada.temporizadorReconexion = setTimeout(async () => {
      entrada.temporizadorReconexion = null;
      const cuenta = await obtenerCuenta(cuentaId);
      if (!cuenta || cuenta.esta_archivada || !cuenta.esta_activa) {
        await this.apagarSocket(cuentaId);
        return;
      }
      try {
        entrada.sock.end(undefined);
      } catch {
        // ignorar
      }
      this.sockets.delete(cuentaId);
      try {
        await this.iniciarSocketCuenta(cuenta);
      } catch (err) {
        console.error(
          `[gestor] falló reconexión cuenta ${cuentaId}:`,
          err,
        );
        this.programarReconexion(cuentaId, codigo);
      }
    }, espera);
  }

  async desconectar(cuentaId: string, limpiarAuth: boolean): Promise<void> {
    const entrada = this.sockets.get(cuentaId);
    if (entrada) {
      if (entrada.temporizadorReconexion) {
        clearTimeout(entrada.temporizadorReconexion);
      }
      try {
        await entrada.sock.logout();
      } catch {
        // ignorar
      }
      try {
        entrada.sock.end(undefined);
      } catch {
        // ignorar
      }
      this.sockets.delete(cuentaId);
    }
    if (limpiarAuth) {
      await borrarSesionBaileysDeCuenta(cuentaId);
    }
    await actualizarEstadoCuenta(cuentaId, {
      estado: "desconectado",
      cadena_qr: null,
      telefono: null,
    });
  }

  private async apagarSocket(cuentaId: string): Promise<void> {
    const entrada = this.sockets.get(cuentaId);
    if (!entrada) return;
    if (entrada.temporizadorReconexion) {
      clearTimeout(entrada.temporizadorReconexion);
    }
    try {
      entrada.sock.end(undefined);
    } catch {
      // ignorar
    }
    this.sockets.delete(cuentaId);
  }

  async apagarTodo(): Promise<void> {
    this.detenido = true;
    for (const id of Array.from(this.sockets.keys())) {
      await this.apagarSocket(id);
    }
  }

  /**
   * Suelta el socket del Map sin llamar sock.logout() (no triggea loggedOut).
   * Usar cuando el usuario pide "Reconectar" o "Desconectar para escanear QR".
   * El próximo ciclo de sincronizar() crea socket nuevo y genera QR.
   */
  liberarSocket(cuentaId: string): void {
    const entrada = this.sockets.get(cuentaId);
    if (!entrada) return;
    if (entrada.temporizadorReconexion) clearTimeout(entrada.temporizadorReconexion);
    try { entrada.sock.end(undefined); } catch { /* ignorar */ }
    this.sockets.delete(cuentaId);
  }

  /**
   * Cierre de sesión INTENCIONAL del usuario: llama sock.logout() para que
   * WhatsApp DESVINCULE el dispositivo del teléfono (no solo soltar el socket
   * local como liberarSocket). Marca el cierre como intencional para que el
   * handler de 'loggedOut' no mande falsas alertas de "cuenta caída".
   * logout() tiene un timeout de 4s para no colgar la request si no responde.
   */
  async cerrarSesionIntencional(cuentaId: string): Promise<void> {
    this.cierresIntencionales.add(cuentaId);
    const entrada = this.sockets.get(cuentaId);
    if (entrada) {
      if (entrada.temporizadorReconexion) clearTimeout(entrada.temporizadorReconexion);
      try {
        await Promise.race([
          entrada.sock.logout(),
          new Promise<void>((resolve) => setTimeout(resolve, 4000)),
        ]);
      } catch {
        /* ignorar — igual soltamos el socket abajo */
      }
      try { entrada.sock.end(undefined); } catch { /* ignorar */ }
      this.sockets.delete(cuentaId);
    }
    // Safety: si el evento 'loggedOut' no llega, limpiamos la marca igual.
    setTimeout(() => this.cierresIntencionales.delete(cuentaId), 15_000);
  }

  obtenerSocket(cuentaId: string): WASocket | null {
    return this.sockets.get(cuentaId)?.sock ?? null;
  }

  cuentasActivas(): string[] {
    return Array.from(this.sockets.keys());
  }

  async procesarBandejasDeSalida(): Promise<void> {
    for (const [cuentaId, entrada] of this.sockets) {
      // El interval dispara cada 20s sin esperar al ciclo anterior. Si
      // una cuenta está mandando media pesada y tarda más que eso, el
      // tick siguiente releía los mismos items (enviado=false todavía)
      // y los mandaba DE NUEVO. Un flag por cuenta lo corta.
      if (this.bandejasEnCurso.has(cuentaId)) continue;
      this.bandejasEnCurso.add(cuentaId);
      try {
        await procesarBandejaSalidaDeCuenta(
          entrada.sock,
          cuentaId,
          entrada.etiqueta,
        );
      } catch (err) {
        console.error(
          `[bot:${entrada.etiqueta}] error procesando bandeja:`,
          err,
        );
      } finally {
        this.bandejasEnCurso.delete(cuentaId);
      }
    }
  }
}

// Singleton persistido en globalThis para sobrevivir Next.js HMR.
// Sin esto, cada vez que editás cualquier archivo que importa gestor.ts,
// el módulo se recarga, el singleton se reinicia desde cero, los
// timers de reconexión se pierden, las pausas por conflicto se
// olvidan, y todas las cuentas se reinician en simultáneo. En dev
// eso causa el loop "abierta/cerrada/abierta/cerrada" sin parar.
const claveGlobalGestor = "__gestorBaileysSingleton" as const;
type GlobalConGestor = typeof globalThis & {
  [claveGlobalGestor]?: GestorCuentas;
};
const gGestor = globalThis as GlobalConGestor;

export function obtenerGestor(): GestorCuentas {
  if (!gGestor[claveGlobalGestor]) {
    gGestor[claveGlobalGestor] = new GestorCuentas();
  }
  return gGestor[claveGlobalGestor]!;
}

export type { GestorCuentas };
