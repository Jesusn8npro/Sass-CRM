"use client";

import { useEffect, useState } from "react";
import type { Cuenta, LlamadaVapi } from "@/lib/baseDatos";

interface EstadoVapi {
  configurado: boolean;
  publicKey: string | null;
  phoneNumberId: string | null;
}

interface Props {
  cuenta: Cuenta;
  telefono: string;
  nombre: string | null;
  onLlamadaIniciada?: (llamada: LlamadaVapi) => void;
}

/**
 * Botón circular que dispara una llamada saliente vía Vapi para esta
 * conversación. Muestra error si la cuenta no tiene Vapi configurado.
 */
export function BotonLlamar({
  cuenta,
  telefono,
  nombre,
  onLlamadaIniciada,
}: Props) {
  const [llamando, setLlamando] = useState(false);
  const [estado, setEstado] = useState<
    | { tipo: "exito"; texto: string }
    | { tipo: "error"; texto: string }
    | null
  >(null);
  // Estado Vapi efectivo (cuenta + fallback al .env del sistema).
  const [estadoVapi, setEstadoVapi] = useState<EstadoVapi | null>(null);

  useEffect(() => {
    fetch(`/api/cuentas/${cuenta.id}/vapi/estado`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EstadoVapi | null) => d && setEstadoVapi(d))
      .catch(() => {});
  }, [cuenta.id]);

  // tieneTodo: configurado (api_key + phone_id efectivos) + assistant
  // (puede venir del campo legacy de la cuenta o del default de
  // assistants_vapi — eso lo resuelve el server al crear la llamada).
  const tieneTodo = !!estadoVapi?.configurado;

  async function llamar() {
    if (llamando) return;
    if (!tieneTodo) {
      setEstado({
        tipo: "error",
        texto:
          "Vapi no está configurado. Andá a Ajustes → Llamadas (Vapi) y completá API key + Phone + Sincronizar.",
      });
      setTimeout(() => setEstado(null), 6000);
      return;
    }
    if (!confirm(`¿Llamar a +${telefono}${nombre ? ` (${nombre})` : ""}?`)) {
      return;
    }
    setLlamando(true);
    setEstado(null);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}/llamadas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, nombre }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { llamada: LlamadaVapi }
        | { error: string };
      if (res.ok && "llamada" in data) {
        setEstado({
          tipo: "exito",
          texto: `📞 Llamada iniciada (id: ${data.llamada.vapi_call_id.slice(0, 8)}…)`,
        });
        onLlamadaIniciada?.(data.llamada);
        setTimeout(() => setEstado(null), 4000);
      } else {
        setEstado({
          tipo: "error",
          texto:
            ("error" in data && data.error) ||
            `Error iniciando llamada (HTTP ${res.status})`,
        });
        setTimeout(() => setEstado(null), 6000);
      }
    } catch (err) {
      setEstado({
        tipo: "error",
        texto: err instanceof Error ? err.message : "Error de red",
      });
      setTimeout(() => setEstado(null), 6000);
    } finally {
      setLlamando(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={llamar}
        disabled={llamando}
        title={tieneTodo ? "Llamar con Vapi" : "Vapi no configurado"}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
          tieneTodo
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
            : "border-zinc-200 text-zinc-400 dark:border-zinc-800"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {llamando ? (
          <span className="h-2 w-2 animate-pulso-suave rounded-full bg-emerald-500" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        )}
        <span className="hidden sm:inline">
          {llamando ? "Llamando..." : "Llamar"}
        </span>
      </button>

      {estado && (
        <div
          className={`absolute right-0 top-full mt-2 w-72 rounded-xl border px-3 py-2 text-xs shadow-lg z-30 ${
            estado.tipo === "exito"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {estado.texto}
        </div>
      )}
    </div>
  );
}
