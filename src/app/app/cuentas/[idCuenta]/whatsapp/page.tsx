"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Cuenta } from "@/lib/baseDatos";
import { PantallaQR } from "@/components/PantallaQR";

interface CuentaConEstado extends Cuenta {
  bot_vivo?: boolean;
  qr_png?: string | null;
}
interface RespuestaCuenta {
  cuenta: CuentaConEstado;
}

const ETIQUETA_ESTADO: Record<string, { texto: string; color: string }> = {
  conectado: { texto: "Conectado", color: "bg-emerald-500" },
  qr: { texto: "Esperando escaneo", color: "bg-amber-500" },
  conectando: { texto: "Conectando…", color: "bg-amber-500/70" },
  desconectado: { texto: "Desconectado", color: "bg-zinc-300" },
};

/**
 * Página /whatsapp — gestión de la conexión Baileys de la cuenta.
 * Muestra estado, número conectado, QR si aplica, y botones para
 * desconectar / regenerar QR.
 */
export default function PaginaWhatsApp() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [cuenta, setCuenta] = useState<CuentaConEstado | null>(null);
  const [accion, setAccion] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const d = (await res.json()) as RespuestaCuenta;
        setCuenta(d.cuenta);
      }
    } catch {
      /* ignorar */
    }
  }

  useEffect(() => {
    void cargar();
    let intervalo: NodeJS.Timeout | null = null;
    const arrancar = () => {
      if (intervalo) clearInterval(intervalo);
      intervalo = setInterval(cargar, 3500); // este page sí se beneficia de polling más rápido para ver el QR live
    };
    const detener = () => {
      if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        cargar();
        arrancar();
      } else detener();
    };
    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      detener();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  async function desconectar(limpiarAuth: boolean) {
    if (
      !confirm(
        limpiarAuth
          ? "Vas a desconectar y BORRAR la sesión. Necesitarás reescanear QR para volver. ¿Continuar?"
          : "Desconectar momentáneamente la cuenta?",
      )
    ) {
      return;
    }
    setAccion(true);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conexion/desconectar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limpiar_auth: limpiarAuth }),
        },
      );
      if (res.ok) {
        setMensaje(
          limpiarAuth
            ? "Sesión borrada. Refrescá para ver el QR nuevo."
            : "Desconectada.",
        );
        await cargar();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setMensaje("✗ " + (d.error ?? `HTTP ${res.status}`));
      }
    } finally {
      setAccion(false);
    }
  }

  if (!cuenta) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando…
      </div>
    );
  }

  const estado = ETIQUETA_ESTADO[cuenta.estado] ?? ETIQUETA_ESTADO.desconectado;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Configuración
        </p>
        <h1 className="text-lg font-bold tracking-tight">Conexión WhatsApp</h1>
      </header>

      {/* Estado */}
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${estado!.color} ${cuenta.estado === "conectado" || cuenta.estado === "qr" ? "animate-pulse" : ""}`}
            />
            <div>
              <p className="text-sm font-semibold">{estado!.texto}</p>
              {cuenta.telefono && (
                <p className="font-mono text-xs text-zinc-500">
                  +{cuenta.telefono}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500">{cuenta.etiqueta}</p>
        </div>

        {/* QR */}
        {cuenta.estado === "qr" || cuenta.estado === "conectando" ? (
          <div className="mt-4">
            <PantallaQR
              idCuenta={idCuenta}
              etiquetaCuenta={cuenta.etiqueta}
              estado={cuenta.estado}
              qrPng={cuenta.qr_png ?? null}
              botVivo={cuenta.bot_vivo ?? false}
            />
          </div>
        ) : cuenta.estado === "conectado" ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            ✓ Tu WhatsApp está conectado. El bot recibe y responde mensajes
            automáticamente.
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
            <p className="mb-3 text-sm text-zinc-500">
              Para conectar el WhatsApp, generá un QR nuevo y escaneálo con tu
              teléfono (Configuración → Dispositivos vinculados → Vincular un
              dispositivo).
            </p>
            <button
              type="button"
              onClick={() => desconectar(true)}
              disabled={accion}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-50"
            >
              Generar QR
            </button>
          </div>
        )}
      </section>

      {/* Acciones */}
      {cuenta.estado === "conectado" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 text-sm font-semibold">Acciones</h2>
          <p className="mb-5 text-xs text-zinc-500">
            Estas acciones afectan la conexión del bot con tu WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => desconectar(false)}
              disabled={accion}
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
            >
              Desconectar (mantener sesión)
            </button>
            <button
              type="button"
              onClick={() => desconectar(true)}
              disabled={accion}
              className="rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-950 dark:text-red-300"
            >
              Cerrar sesión y borrar credenciales
            </button>
          </div>
          {mensaje && (
            <p className="mt-3 text-xs text-zinc-500">{mensaje}</p>
          )}
        </section>
      )}

      {/* Info / consejos */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
          ¿Por qué WhatsApp cierra sesión?
        </p>
        <ul className="mt-2 space-y-1 leading-relaxed">
          <li>• Tener más de 4 dispositivos vinculados al mismo número.</li>
          <li>• 14+ días sin abrir WhatsApp en el móvil principal.</li>
          <li>• Cerrar sesión manualmente desde el celular.</li>
          <li>
            • Detecciones anti-spam de Meta (envío masivo no humano, etc).
          </li>
        </ul>
        <p className="mt-3">
          Si esto pasa, recibís una notificación y solo tenés que generar un
          QR nuevo y reescanearlo. Tus conversaciones, contactos y mensajes
          quedan guardados — la cuenta se mantiene intacta.
        </p>
      </section>
    </div>
  );
}
