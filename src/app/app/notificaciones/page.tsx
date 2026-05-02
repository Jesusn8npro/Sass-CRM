"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { NotificacionSistema } from "@/lib/baseDatos";

const ICONO_TIPO: Record<string, string> = {
  cuenta_desconectada: "🔌",
  cuenta_qr_listo: "📱",
  llamada_fallida: "📞",
  limite_plan_alcanzado: "⚠️",
  sistema: "🔔",
};

const COLOR_TIPO: Record<string, string> = {
  cuenta_desconectada:
    "border-red-500/30 bg-red-50 dark:bg-red-900/10",
  cuenta_qr_listo:
    "border-amber-500/30 bg-amber-50 dark:bg-amber-900/10",
  llamada_fallida:
    "border-orange-500/30 bg-orange-50 dark:bg-orange-900/10",
  limite_plan_alcanzado:
    "border-purple-500/30 bg-purple-50 dark:bg-purple-900/10",
  sistema: "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
};

export default function PaginaNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<NotificacionSistema[]>(
    [],
  );
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/notificaciones", { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as {
          notificaciones: NotificacionSistema[];
        };
        setNotificaciones(d.notificaciones);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function marcarLeida(id: string) {
    await fetch(`/api/notificaciones/${id}`, { method: "PATCH" });
    setNotificaciones((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, leida: true, leida_en: new Date().toISOString() }
          : n,
      ),
    );
  }

  async function marcarTodas() {
    await fetch("/api/notificaciones/marcar-todas", { method: "POST" });
    await cargar();
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span>←</span> Volver al panel
          </Link>
          <h1 className="text-base font-semibold">Notificaciones</h1>
          <button
            type="button"
            onClick={marcarTodas}
            disabled={noLeidas === 0}
            className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-40 dark:text-emerald-400"
          >
            Marcar todas leídas
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : notificaciones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 text-4xl">🔔</div>
            <p className="text-sm font-medium">Sin notificaciones</p>
            <p className="mt-1 text-xs text-zinc-500">
              Vas a ver acá cuando una cuenta se desconecte, una llamada falle
              o haya algo que requiera tu atención.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notificaciones.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 transition-all ${
                  COLOR_TIPO[n.tipo] ?? COLOR_TIPO.sistema
                } ${n.leida ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    {ICONO_TIPO[n.tipo] ?? ICONO_TIPO.sistema}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {n.titulo}
                      </h3>
                      <time className="shrink-0 text-[10px] text-zinc-500">
                        {new Date(n.creada_en).toLocaleString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                      {n.mensaje}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {n.cuenta_id && (
                        <Link
                          href={`/app/cuentas/${n.cuenta_id}`}
                          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Ir a la cuenta →
                        </Link>
                      )}
                      {!n.leida && (
                        <button
                          type="button"
                          onClick={() => marcarLeida(n.id)}
                          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          Marcar como leída
                        </button>
                      )}
                      {n.email_enviado && (
                        <span className="text-[10px] text-zinc-400">
                          ✉ email enviado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
