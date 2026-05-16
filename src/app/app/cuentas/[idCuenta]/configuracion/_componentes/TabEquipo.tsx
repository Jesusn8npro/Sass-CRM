"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cuenta } from "@/lib/baseDatos";

interface Miembro {
  id: string;
  usuario_id: string;
  rol: "agente" | "admin";
  email?: string;
  nombre?: string | null;
  creado_en: string;
}

export function TabEquipo({ cuenta }: { cuenta: Cuenta }) {
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"agente" | "admin">("agente");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/cuentas/${cuenta.id}/miembros`);
    if (r.ok) {
      const d = await r.json() as { miembros: Miembro[] };
      setMiembros(d.miembros);
    }
  }, [cuenta.id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    const r = await fetch(`/api/cuentas/${cuenta.id}/miembros`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, rol }),
    });
    const d = await r.json() as { ok?: boolean; error?: string };
    if (r.ok && d.ok) {
      setMsg({ tipo: "ok", texto: `✓ ${email} agregado como ${rol}` });
      setEmail("");
      void cargar();
    } else {
      setMsg({ tipo: "err", texto: d.error ?? "Error al invitar" });
    }
    setGuardando(false);
  }

  async function remover(usuarioId: string) {
    await fetch(`/api/cuentas/${cuenta.id}/miembros`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId }),
    });
    void cargar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Equipo</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Agregá agentes que puedan ver y atender conversaciones de esta cuenta.
          Deben tener cuenta creada en la plataforma.
        </p>
      </div>

      <form onSubmit={(e) => void invitar(e)} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@agente.com"
          required
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        />
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as "agente" | "admin")}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <option value="agente">Agente</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {guardando ? "Agregando…" : "+ Agregar"}
        </button>
      </form>

      {msg && (
        <p className={`text-sm ${msg.tipo === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          {msg.texto}
        </p>
      )}

      {miembros.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay agentes agregados aún.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {miembros.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {m.nombre ?? m.email ?? m.usuario_id}
                </p>
                {m.nombre && <p className="text-xs text-zinc-400">{m.email}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  m.rol === "admin"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}>
                  {m.rol}
                </span>
                <button
                  type="button"
                  onClick={() => void remover(m.usuario_id)}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
