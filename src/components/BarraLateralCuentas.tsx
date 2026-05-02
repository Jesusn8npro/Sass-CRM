"use client";

import { useEffect, useState } from "react";
import type { Cuenta, EstadoConexion } from "@/lib/baseDatos";
import { InterruptorTema } from "./InterruptorTema";
import { crearClienteNavegador } from "@/lib/supabase/cliente-navegador";

export interface CuentaConEstado extends Cuenta {
  bot_vivo?: boolean;
  qr_png?: string | null;
}

interface Props {
  cuentas: CuentaConEstado[];
  idSeleccionada: number | null;
  onSeleccionar: (id: number) => void;
  onNueva: () => void;
}

function colorEstado(estado: EstadoConexion, botVivo: boolean): string {
  if (!botVivo) return "bg-zinc-300 dark:bg-zinc-700";
  if (estado === "conectado") return "bg-emerald-500 animate-pulso-suave";
  if (estado === "qr") return "bg-amber-500 animate-pulso-suave";
  if (estado === "conectando") return "bg-emerald-500/50 animate-pulso-suave";
  return "bg-zinc-300 dark:bg-zinc-700";
}

function inicialesDe(etiqueta: string): string {
  const partes = etiqueta.trim().split(/\s+/);
  const i1 = partes[0]?.[0] ?? "";
  const i2 = partes[1]?.[0] ?? "";
  return (i1 + i2).toUpperCase() || "??";
}

export function BarraLateralCuentas({
  cuentas,
  idSeleccionada,
  onSeleccionar,
  onNueva,
}: Props) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white/40 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Agente WhatsApp
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
          {cuentas.length} {cuentas.length === 1 ? "cuenta" : "cuentas"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {cuentas.length === 0 ? (
          <div className="m-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
            <p className="text-xs text-zinc-500">
              Sin cuentas todavía. Creá la primera.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {cuentas.map((c) => {
              const seleccionada = c.id === idSeleccionada;
              const indicador = colorEstado(c.estado, !!c.bot_vivo);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSeleccionar(c.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${
                      seleccionada
                        ? "border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800/60"
                        : "border-transparent hover:border-zinc-200 hover:bg-white/70 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                      {inicialesDe(c.etiqueta)}
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950 ${indicador}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {c.etiqueta}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                        {c.telefono ? `+${c.telefono}` : "sin conectar"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={onNueva}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Nueva cuenta
        </button>
        <div className="mt-3 flex items-center justify-end">
          <InterruptorTema />
        </div>
      </div>

      <BloqueUsuario />
    </aside>
  );
}

/**
 * Footer con email del usuario logueado + botón cerrar sesión.
 * Usa el cliente Supabase del navegador para leer la sesión actual.
 */
function BloqueUsuario() {
  const [email, setEmail] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function cerrarSesion() {
    if (cerrando) return;
    setCerrando(true);
    // Vamos por POST al endpoint que limpia cookies del lado server.
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/cerrar-sesion";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          {email ? email.slice(0, 2).toUpperCase() : "··"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
            {email ?? "Cargando…"}
          </p>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          disabled={cerrando}
          title="Cerrar sesión"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
