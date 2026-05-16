"use client";

import { useState } from "react";

export interface ApiKey {
  id: string;
  cuenta_id: string;
  nombre: string;
  prefijo: string;
  permisos: string[];
  ultima_uso_en: string | null;
  revocada_en: string | null;
  expira_en: string | null;
  creado_en: string;
}

export interface RespuestaCrear {
  api_key: ApiKey;
  clave_plaintext: string;
}

export function ModalCrearKey({ idCuenta, onCerrar, onCreada }: { idCuenta: string; onCerrar: () => void; onCreada: (d: RespuestaCrear) => void }) {
  const [nombre, setNombre] = useState("");
  const [permRead, setPermRead] = useState(true);
  const [permWrite, setPermWrite] = useState(true);
  const [expiraDias, setExpiraDias] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setError(null);
    if (!nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!permRead && !permWrite) { setError("Seleccioná al menos un permiso"); return; }
    setEnviando(true);
    try {
      const permisos: string[] = [];
      if (permRead) permisos.push("read");
      if (permWrite) permisos.push("write");
      const expiraEn = expiraDias
        ? new Date(Date.now() + Number(expiraDias) * 86400 * 1000).toISOString()
        : null;
      const res = await fetch(`/api/cuentas/${idCuenta}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), permisos, expira_en: expiraEn }),
      });
      const data = (await res.json().catch(() => ({}))) as RespuestaCrear | { error?: string };
      if (!res.ok) { setError(("error" in data && data.error) || "No se pudo crear la clave"); return; }
      onCreada(data as RespuestaCrear);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Crear nueva clave de API</h2>
        <p className="mt-1 text-xs text-zinc-500">Vas a poder copiar el valor completo solo una vez después de crearla.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Zapier Producción" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900" maxLength={80} autoFocus />
            <p className="mt-1 text-[10px] text-zinc-500">Etiqueta interna para reconocerla después.</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Permisos</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                <input type="checkbox" checked={permRead} onChange={(e) => setPermRead(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <div><p className="text-xs font-semibold">read</p><p className="text-[10px] text-zinc-500">Leer conversaciones e información de la cuenta.</p></div>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                <input type="checkbox" checked={permWrite} onChange={(e) => setPermWrite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <div><p className="text-xs font-semibold">write</p><p className="text-[10px] text-zinc-500">Enviar mensajes salientes desde el bot.</p></div>
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Vencimiento (opcional)</label>
            <select
              value={expiraDias}
              onChange={(e) => setExpiraDias(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Sin vencimiento</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="180">180 días</option>
              <option value="365">1 año</option>
            </select>
            <p className="mt-1 text-[10px] text-zinc-500">Después de esta fecha la clave dejará de funcionar automáticamente.</p>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">Cancelar</button>
          <button type="button" onClick={enviar} disabled={enviando} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">{enviando ? "Creando…" : "Crear clave"}</button>
        </div>
      </div>
    </div>
  );
}

export function ModalMostrarPlaintext({ plaintext, nombre, onCerrar }: { plaintext: string; nombre: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* Si falla el clipboard (https requerido), el usuario puede copiar manualmente */ }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-300 bg-white p-6 shadow-2xl dark:border-emerald-500/40 dark:bg-zinc-950">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">✓</div>
          <div>
            <h2 className="text-lg font-semibold">Clave creada</h2>
            <p className="mt-0.5 text-xs text-zinc-500"><strong>{nombre}</strong> — copiala ahora, no se mostrará de nuevo.</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">Tu clave</p>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
            <code className="flex-1 truncate font-mono text-xs">{plaintext}</code>
            <button type="button" onClick={copiar} className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">{copiado ? "✓ Copiado" : "Copiar"}</button>
          </div>
          <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">⚠ Guardala en un lugar seguro. Si la perdés, tenés que crear una nueva.</p>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onCerrar} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">Listo</button>
        </div>
      </div>
    </div>
  );
}
