"use client";

import { useState } from "react";
import type { Conversacion } from "@/lib/baseDatos";

interface Props {
  abierto: boolean;
  idCuenta: number;
  onCerrar: () => void;
  onCreada: (conv: Conversacion) => void;
}

export function ModalNuevaConversacion({
  abierto,
  idCuenta,
  onCerrar,
  onCreada,
}: Props) {
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  function cerrar() {
    if (enviando) return;
    setTelefono("");
    setNombre("");
    setMensaje("");
    setError(null);
    onCerrar();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const tel = telefono.replace(/[^\d]/g, "");
    if (tel.length < 8 || tel.length > 15) {
      setError("Número inválido. Incluí código de país (ej: 5491123456789).");
      return;
    }
    if (!mensaje.trim()) {
      setError("El mensaje no puede estar vacío.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conversaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: tel,
          nombre: nombre.trim() || null,
          mensaje: mensaje.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? `Error iniciando conversación (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as { conversacion: Conversacion };
      setTelefono("");
      setNombre("");
      setMensaje("");
      onCreada(data.conversacion);
    } catch (err) {
      console.error("[modal-nueva-conv] error:", err);
      setError("Error de red al iniciar la conversación");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nueva conversación
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Envía el primer mensaje a un número y empieza el chat.
          </p>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Número con código de país
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 5491123456789"
              autoFocus
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Solo dígitos. Sin <code>+</code>, sin espacios, sin guiones.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Nombre de contacto (opcional)
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              maxLength={80}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Primer mensaje
            </label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={4}
              placeholder="Hola, gracias por tu interés..."
              required
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              La conversación arranca en modo <strong>Humano</strong>. Cambialo
              a IA desde el chat si querés respuestas automáticas.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              disabled={enviando}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !telefono.trim() || !mensaje.trim()}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Enviando..." : "Iniciar chat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
