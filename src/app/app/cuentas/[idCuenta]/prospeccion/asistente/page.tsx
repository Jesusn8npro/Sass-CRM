"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { CampoExtraccion } from "./_campos-extraccion";
import { NOMBRES_PREDEFINIDOS, CamposExtraccion, obtenerCamposParaEnviar } from "./_campos-extraccion";

const MODELOS = [
  { value: "gpt-4o", label: "GPT-4o (más capaz)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (más rápido)" },
];

interface AsistenteConfig {
  id: string;
  nombre: string;
  primerMensaje: string;
  systemPrompt: string;
  modelo: string;
  serverUrl: string;
  campos: CampoExtraccion[];
}

interface GuardarRespuesta {
  ok?: boolean;
  error?: string;
  serverUrl?: string;
  campos?: CampoExtraccion[];
}

export default function PaginaAsistenteProspeccion() {
  const params = useParams();
  const idCuenta = params.idCuenta as string;

  const [config, setConfig] = useState<AsistenteConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const [nombre, setNombre] = useState("");
  const [primerMensaje, setPrimerMensaje] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [serverUrl, setServerUrl] = useState("");

  const [camposActivos, setCamposActivos] = useState<Set<string>>(new Set());
  const [camposPersonalizados, setCamposPersonalizados] = useState<CampoExtraccion[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/asistente`);
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "Error cargando asistente");
        return;
      }
      const d = await r.json() as AsistenteConfig;
      setConfig(d);
      setNombre(d.nombre);
      setPrimerMensaje(d.primerMensaje);
      setSystemPrompt(d.systemPrompt);
      setModelo(d.modelo);
      setServerUrl(d.serverUrl);
      const activos = new Set<string>();
      const personalizados: CampoExtraccion[] = [];
      for (const c of d.campos) {
        if (NOMBRES_PREDEFINIDOS.has(c.nombre)) activos.add(c.nombre);
        else personalizados.push(c);
      }
      setCamposActivos(activos);
      setCamposPersonalizados(personalizados);
    } catch {
      setError("No se pudo conectar con Vapi");
    } finally {
      setCargando(false);
    }
  }, [idCuenta]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(false);
    try {
      const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/asistente`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, primerMensaje, systemPrompt, modelo, serverUrl, campos: obtenerCamposParaEnviar(camposActivos, camposPersonalizados) }),
      });
      const d = await r.json() as GuardarRespuesta;
      if (!r.ok || !d.ok) { setError(d.error ?? "Error guardando"); return; }
      if (typeof d.serverUrl === "string") setServerUrl(d.serverUrl);
      if (Array.isArray(d.campos)) {
        const activos = new Set<string>();
        const personalizados: CampoExtraccion[] = [];
        for (const c of d.campos) {
          if (NOMBRES_PREDEFINIDOS.has(c.nombre)) activos.add(c.nombre);
          else personalizados.push(c);
        }
        setCamposActivos(activos);
        setCamposPersonalizados(personalizados);
      }
      setExito(true);
      setTimeout(() => setExito(false), 4000);
    } catch {
      setError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href={`/app/cuentas/${idCuenta}/prospeccion`} className="text-xs text-zinc-400 hover:text-zinc-600">← Volver al pipeline</Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">Configurar Asistente de Prospección</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Edita el agente IA que hace las llamadas. Los cambios se sincronizan con Vapi al guardar.</p>
          {config && <p className="text-xs text-zinc-400 mt-1">ID Vapi: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{config.id}</code></p>}
        </div>

        {cargando && <div className="py-16 text-center text-sm text-zinc-400">Cargando configuración desde Vapi...</div>}

        {error && !cargando && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{error}</div>
        )}

        {exito && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 dark:bg-emerald-900/20 dark:border-emerald-800">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Guardado en Vapi correctamente</p>
            {serverUrl && <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5 truncate">Webhook: {serverUrl}</p>}
            {(camposActivos.size + camposPersonalizados.length) > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Extrayendo {camposActivos.size + camposPersonalizados.length} campos de cada llamada</p>
            )}
          </div>
        )}

        {!cargando && config && (
          <form onSubmit={guardar} className="space-y-5">
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nombre del asistente</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Ej: Natalia — Asesora Comercial" />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Primer mensaje <span className="text-xs font-normal text-zinc-400">(lo que dice el agente al contestar)</span>
              </label>
              <textarea value={primerMensaje} onChange={e => setPrimerMensaje(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              <p className="mt-1 text-xs text-zinc-400">Este mensaje se anula por el que genera el pipeline para cada lead. Solo aplica si llamas manualmente.</p>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                System Prompt <span className="text-xs font-normal text-zinc-400">(instrucciones del agente)</span>
              </label>
              <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={16} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y font-mono" />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Modelo IA</label>
                <select value={modelo} onChange={e => setModelo(e.target.value)} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {MODELOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Webhook URL <span className="text-xs font-normal text-zinc-400">(Server URL en Vapi)</span>
                </label>
                <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://tu-app.com/api/vapi/webhook" />
              </div>
            </div>

            <CamposExtraccion
              camposActivos={camposActivos}
              onToggleCampo={(n) => setCamposActivos(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; })}
              camposPersonalizados={camposPersonalizados}
              onAgregarPersonalizado={(c) => setCamposPersonalizados(prev => [...prev, c])}
              onEliminarPersonalizado={(idx) => setCamposPersonalizados(prev => prev.filter((_, i) => i !== idx))}
            />

            <div className="flex justify-end gap-3">
              <button type="button" onClick={cargar} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800">Recargar desde Vapi</button>
              <button type="submit" disabled={guardando} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-6 py-2 text-sm font-semibold text-white transition-colors">{guardando ? "Guardando..." : "Guardar en Vapi"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
