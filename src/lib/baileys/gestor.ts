import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  type WASocket,
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

interface ErrorConCodigo {
  output?: { statusCode?: number };
  statusCode?: number;
}

interface SocketCuenta {
  cuentaId: string;
  etiqueta: string;
  sock: WASocket;
  temporizadorReconexion: NodeJS.Timeout | null;
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

    // Iniciar sockets para cuentas nuevas
    for (const cuenta of cuentas) {
      if (!this.sockets.has(cuenta.id)) {
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

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      // markOnlineOnConnect=true es necesario para que el indicador
      // "escribiendo..." funcione: WhatsApp solo lo muestra cuando
      // estamos online ante el contacto.
      markOnlineOnConnect: true,
      syncFullHistory: false,
    });

    const entrada: SocketCuenta = {
      cuentaId: cuenta.id,
      etiqueta: cuenta.etiqueta,
      sock,
      temporizadorReconexion: null,
    };
    this.sockets.set(cuenta.id, entrada);

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
        console.log(`${prefijo} conexión abierta. Número: ${telefono ?? "?"}`);
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
        console.log(
          `${prefijo} conexión cerrada. Código: ${codigo ?? "desconocido"}`,
        );

        if (codigo === DisconnectReason.loggedOut) {
          console.log(
            `${prefijo} sesión cerrada por WhatsApp. Limpiando creds.`,
          );
          void actualizarEstadoCuenta(cuenta.id, {
            estado: "desconectado",
            cadena_qr: null,
            telefono: null,
          });
          // Borrar la sesión de Supabase para que el siguiente arranque
          // genere QR limpio.
          void borrarSesionBaileysDeCuenta(cuenta.id).catch(() => {});
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
    const espera = codigo === 440 ? 15000 : 5000;
    console.log(
      `[bot:${entrada.etiqueta}] reintentando conexión en ${espera / 1000}s...`,
    );
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

  obtenerSocket(cuentaId: string): WASocket | null {
    return this.sockets.get(cuentaId)?.sock ?? null;
  }

  cuentasActivas(): string[] {
    return Array.from(this.sockets.keys());
  }

  async procesarBandejasDeSalida(): Promise<void> {
    for (const [cuentaId, entrada] of this.sockets) {
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
      }
    }
  }
}

let gestorSingleton: GestorCuentas | null = null;

export function obtenerGestor(): GestorCuentas {
  if (!gestorSingleton) {
    gestorSingleton = new GestorCuentas();
  }
  return gestorSingleton;
}

export type { GestorCuentas };
