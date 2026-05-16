"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import type { ApiKey, RespuestaCrear } from "./_PanelApiKeys-modales";
import { ModalCrearKey, ModalMostrarPlaintext } from "./_PanelApiKeys-modales";

interface RespuestaLista {
  api_keys: ApiKey[];
}

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export function PanelApiKeys({ idCuenta }: { idCuenta: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [claveRecienCreada, setClaveRecienCreada] = useState<{ apiKey: ApiKey; plaintext: string } | null>(null);
  const toast = useToast();
  const { confirmar } = useConfirm();

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/api-keys`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as RespuestaLista;
        setKeys(d.api_keys);
      } else if (res.status === 503) {
        toast.error("Las API Keys no están habilitadas todavía (falta la migración 10).");
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, [idCuenta]); // eslint-disable-line react-hooks/exhaustive-deps

  async function revocar(id: string, nombre: string) {
    const ok = await confirmar({ mensaje: `¿Revocar la clave "${nombre}"? Las integraciones que la estén usando dejarán de funcionar inmediatamente.`, textoConfirmar: "Revocar", variante: "peligro" });
    if (!ok) return;
    const res = await fetch(`/api/cuentas/${idCuenta}/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) { toast.exito("Clave revocada"); void cargar(); }
    else { const d = (await res.json().catch(() => ({}))) as { error?: string }; toast.error(d.error ?? "No se pudo revocar la clave"); }
  }

  function activa(k: ApiKey): boolean {
    if (k.revocada_en) return false;
    if (k.expira_en && new Date(k.expira_en).getTime() < Date.now()) return false;
    return true;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-white via-emerald-50/30 to-white px-6 pt-6 pb-4 dark:border-zinc-800 dark:from-zinc-950 dark:via-emerald-950/10 dark:to-zinc-950">
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg text-white shadow-md">🔑</div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Integraciones · API Keys</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Claves de API</h1>
                <p className="text-xs text-zinc-500">Generá claves para integrar tu CRM con Zapier, Make, n8n o tu propio sistema.</p>
              </div>
            </div>
            <button type="button" onClick={() => setModalAbierto(true)} className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700">+ Crear nueva clave</button>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">⚠</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Tratá las claves como contraseñas</p>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">Solo se muestra el valor completo <strong>UNA VEZ</strong> al crearla. Después solo verás el prefijo. Si la perdés, tenés que crear una nueva.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 px-6 py-5 dark:bg-zinc-950">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : keys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-3xl">🔑</p>
            <p className="mt-2 font-semibold">Aún no tenés claves de API</p>
            <p className="mt-1 text-xs text-zinc-500">Tocá &quot;+ Crear nueva clave&quot; para generar la primera.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Prefijo</th>
                  <th className="px-4 py-3">Permisos</th>
                  <th className="px-4 py-3">Último uso</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{k.nombre}</p>
                      <p className="text-[10px] text-zinc-500">Creada {new Date(k.creado_en).toLocaleDateString("es-AR")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{k.prefijo}…</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.permisos.length === 0
                          ? <span className="text-zinc-400">—</span>
                          : k.permisos.map((p) => <span key={p} className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">{p}</span>)
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{tiempoRelativo(k.ultima_uso_en)}</td>
                    <td className="px-4 py-3 text-xs">
                      {k.expira_en ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          new Date(k.expira_en).getTime() - Date.now() < 7 * 86400 * 1000
                            ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                          {new Date(k.expira_en).toLocaleDateString("es-AR")}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${activa(k) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${activa(k) ? "bg-emerald-500" : "bg-zinc-400"}`} />
                        {activa(k) ? "Activa" : "Revocada"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {activa(k)
                        ? <button type="button" onClick={() => revocar(k.id, k.nombre)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Revocar</button>
                        : <span className="text-[11px] text-zinc-400">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <ModalCrearKey idCuenta={idCuenta} onCerrar={() => setModalAbierto(false)} onCreada={(d: RespuestaCrear) => { setModalAbierto(false); setClaveRecienCreada({ apiKey: d.api_key, plaintext: d.clave_plaintext }); void cargar(); }} />
      )}
      {claveRecienCreada && (
        <ModalMostrarPlaintext plaintext={claveRecienCreada.plaintext} nombre={claveRecienCreada.apiKey.nombre} onCerrar={() => setClaveRecienCreada(null)} />
      )}
    </div>
  );
}
