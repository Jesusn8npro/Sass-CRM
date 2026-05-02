"use client";

import { useEffect, useRef, useState } from "react";
import type { EstadoConexion } from "@/lib/baseDatos";

interface Props {
  idCuenta: string;
  etiquetaCuenta: string;
  estado: EstadoConexion;
  qrPng: string | null;
  botVivo: boolean;
}

export function PantallaQR({
  idCuenta,
  etiquetaCuenta,
  estado,
  qrPng,
  botVivo,
}: Props) {
  const [tiempoSinQR, setTiempoSinQR] = useState(0);
  const [forzando, setForzando] = useState(false);
  const refInicioSinQR = useRef<number>(Date.now());

  // Contador de cuánto tiempo lleva sin QR visible
  useEffect(() => {
    if (estado === "qr" && qrPng) {
      refInicioSinQR.current = Date.now();
      setTiempoSinQR(0);
      return;
    }
    const tick = setInterval(() => {
      setTiempoSinQR(Math.floor((Date.now() - refInicioSinQR.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [estado, qrPng]);

  async function forzarNuevoQR() {
    if (forzando) return;
    setForzando(true);
    try {
      // Misma acción que "Desconectar": limpia auth/{id}/, el gestor del bot
      // detecta el cambio en su próxima sincronización y regenera el QR.
      await fetch(`/api/cuentas/${idCuenta}/conexion/desconectar`, {
        method: "POST",
      });
      refInicioSinQR.current = Date.now();
      setTiempoSinQR(0);
    } finally {
      // Pequeña espera para evitar dobles clicks; el QR aparece en ~3-8s
      setTimeout(() => setForzando(false), 3000);
    }
  }

  const mostrandoQR = estado === "qr" && !!qrPng;
  const qrColgado = botVivo && !mostrandoQR && tiempoSinQR > 10;
  const botMuerto = !botVivo;

  return (
    <main className="flex h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {etiquetaCuenta}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Conecta tu número
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Escanea este código con WhatsApp en tu teléfono para vincular
            esta cuenta. Ajustes → Dispositivos vinculados → Vincular un
            dispositivo.
          </p>
        </div>

        <div className="relative rounded-3xl border border-zinc-200 bg-white/70 p-6 shadow-xl shadow-zinc-200/40 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-2xl dark:shadow-black/40">
          <div className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-950">
            {mostrandoQR && qrPng ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrPng}
                alt="Código QR de WhatsApp"
                className="h-full w-full rounded-xl"
              />
            ) : estado === "conectando" ? (
              <EstadoCargando texto="Conectando..." color="emerald" />
            ) : estado === "conectado" ? (
              <EstadoCargando
                texto="Conectado, abriendo panel..."
                color="emerald"
              />
            ) : botMuerto ? (
              <EstadoCargando
                texto="El bot no está corriendo. Ejecutá npm run dev:all en una terminal."
                color="amber"
              />
            ) : qrColgado ? (
              <EstadoCargando
                texto="El bot no devolvió QR. Intentá generar uno nuevo abajo."
                color="amber"
              />
            ) : (
              <EstadoCargando texto="Esperando QR..." color="zinc" />
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <Indicador estado={estado} />
          </div>

          {/* Botón forzar nuevo QR — visible cuando está colgado */}
          {(qrColgado || (botVivo && estado === "conectando" && tiempoSinQR > 15)) && (
            <button
              type="button"
              onClick={forzarNuevoQR}
              disabled={forzando}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/15 disabled:opacity-50 dark:text-amber-300"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 ${forzando ? "animate-spin" : ""}`}
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              {forzando ? "Regenerando..." : "Generar nuevo QR"}
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-600">
          La sesión queda guardada localmente en{" "}
          <code className="font-mono text-[11px]">auth/{idCuenta}/</code>.
          No volverás a escanear este QR salvo que cierres la sesión.
        </p>
      </div>
    </main>
  );
}

function EstadoCargando({
  texto,
  color,
}: {
  texto: string;
  color: "emerald" | "amber" | "zinc";
}) {
  const clasesColor =
    color === "emerald"
      ? "bg-emerald-500"
      : color === "amber"
      ? "bg-amber-500"
      : "bg-zinc-400 dark:bg-zinc-500";
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <span className={`h-3 w-3 animate-pulso-suave rounded-full ${clasesColor}`} />
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{texto}</p>
    </div>
  );
}

function Indicador({ estado }: { estado: EstadoConexion }) {
  const config = {
    qr: { color: "bg-amber-500", texto: "Esperando escaneo" },
    conectando: { color: "bg-emerald-500", texto: "Conectando" },
    conectado: { color: "bg-emerald-500", texto: "Conectado" },
    desconectado: {
      color: "bg-zinc-400 dark:bg-zinc-600",
      texto: "Desconectado",
    },
  } as const;
  const c = config[estado];
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
      <span className={`h-1.5 w-1.5 animate-pulso-suave rounded-full ${c.color}`} />
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {c.texto}
      </span>
    </div>
  );
}
