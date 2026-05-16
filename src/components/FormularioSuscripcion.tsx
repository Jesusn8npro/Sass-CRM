"use client";

import { useState } from "react";

export function FormularioSuscripcion() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "cargando" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEstado("cargando");
    try {
      const res = await fetch("/api/blog/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setEstado("ok");
        setMensaje(data.mensaje ?? "Revisá tu email para confirmar.");
      } else {
        setEstado("error");
        setMensaje(data.error ?? "Ocurrió un error. Intentá de nuevo.");
      }
    } catch {
      setEstado("error");
      setMensaje("Error de conexión. Intentá de nuevo.");
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-500">Newsletter</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        Nuevos artículos directo a tu email. Sin spam.
      </p>
      {estado === "ok" ? (
        <p className="mt-3 text-xs font-semibold text-emerald-400">{mensaje}</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-400/40 focus:ring-0"
          />
          <button
            type="submit"
            disabled={estado === "cargando"}
            className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {estado === "cargando" ? "Enviando…" : "Suscribirse"}
          </button>
          {estado === "error" && (
            <p className="text-[11px] text-red-400">{mensaje}</p>
          )}
        </form>
      )}
    </div>
  );
}
