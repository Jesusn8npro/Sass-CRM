"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface CampoExtraccion {
  nombre: string;
  descripcion: string;
  tipo: "string" | "boolean" | "number";
  opciones?: string[];
}

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
  systemPrompt?: string;
}

const MODELOS = [
  { value: "gpt-4o", label: "GPT-4o (más capaz)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (más rápido)" },
];

const CAMPOS_PREDEFINIDOS: (CampoExtraccion & { label: string })[] = [
  { nombre: "nombre_contacto", label: "Nombre del contacto", descripcion: "Nombre completo de la persona con quien habló el agente", tipo: "string" },
  { nombre: "cargo", label: "Cargo / puesto", descripcion: "Cargo o puesto de la persona contactada", tipo: "string" },
  { nombre: "email", label: "Email", descripcion: "Email mencionado o proporcionado durante la llamada", tipo: "string" },
  { nombre: "nivel_interes", label: "Nivel de interés", descripcion: "Nivel de interés del prospecto en el servicio ofrecido", tipo: "string", opciones: ["alto", "medio", "bajo", "no_interesado"] },
  { nombre: "reunion_agendada", label: "Reunión agendada", descripcion: "Si se agendó una reunión al final de la llamada", tipo: "boolean" },
  { nombre: "fecha_reunion", label: "Fecha de reunión", descripcion: "Fecha y hora de la reunión si fue agendada", tipo: "string" },
  { nombre: "objecion_principal", label: "Objeción principal", descripcion: "Principal objeción o rechazo expresado por el prospecto", tipo: "string" },
  { nombre: "proximo_paso", label: "Próximo paso", descripcion: "Próximo paso acordado al finalizar la llamada", tipo: "string" },
  { nombre: "notas", label: "Notas adicionales", descripcion: "Observaciones adicionales relevantes de la llamada", tipo: "string" },
];

const NOMBRES_PREDEFINIDOS = new Set(CAMPOS_PREDEFINIDOS.map(c => c.nombre));

const TIPO_LABEL: Record<string, string> = {
  string: "Texto",
  boolean: "Sí / No",
  number: "Número",
};

export default function PaginaAsistenteProspeccion() {
  const params = useParams();
  const idCuenta = params.idCuenta as string;

  const [config, setConfig] = useState<AsistenteConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  // Campos básicos
  const [nombre, setNombre] = useState("");
  const [primerMensaje, setPrimerMensaje] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [serverUrl, setServerUrl] = useState("");

  // Campos de extracción
  const [camposActivos, setCamposActivos] = useState<Set<string>>(new Set());
  const [camposPersonalizados, setCamposPersonalizados] = useState<CampoExtraccion[]>([]);

  // Formulario para nuevo campo personalizado
  const [mostrarFormCampo, setMostrarFormCampo] = useState(false);
  const [nuevoCampoNombre, setNuevoCampoNombre] = useState("");
  const [nuevoCampoDesc, setNuevoCampoDesc] = useState("");
  const [nuevoCampoTipo, setNuevoCampoTipo] = useState<"string" | "boolean" | "number">("string");

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

      // Separar campos predefinidos activos de personalizados
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

  function toggleCampo(nombre: string) {
    setCamposActivos(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

  function agregarCampoPersonalizado() {
    const clave = nuevoCampoNombre.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!clave || !nuevoCampoDesc.trim()) return;
    setCamposPersonalizados(prev => [...prev, {
      nombre: clave,
      descripcion: nuevoCampoDesc.trim(),
      tipo: nuevoCampoTipo,
    }]);
    setNuevoCampoNombre("");
    setNuevoCampoDesc("");
    setNuevoCampoTipo("string");
    setMostrarFormCampo(false);
  }

  function eliminarCampoPersonalizado(idx: number) {
    setCamposPersonalizados(prev => prev.filter((_, i) => i !== idx));
  }

  function getCamposParaEnviar(): CampoExtraccion[] {
    const predefinidos = CAMPOS_PREDEFINIDOS
      .filter(c => camposActivos.has(c.nombre))
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ label, ...rest }) => rest);
    return [...predefinidos, ...camposPersonalizados];
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setExito(false);
    try {
      const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/asistente`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre, primerMensaje, systemPrompt, modelo, serverUrl,
          campos: getCamposParaEnviar(),
        }),
      });
      const d = await r.json() as GuardarRespuesta;
      if (!r.ok || !d.ok) {
        setError(d.error ?? "Error guardando");
        return;
      }
      // Actualizar estado con los valores confirmados por Vapi
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

  const totalCampos = camposActivos.size + camposPersonalizados.length;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-6">
          <Link href={`/app/cuentas/${idCuenta}/prospeccion`} className="text-xs text-zinc-400 hover:text-zinc-600">
            ← Volver al pipeline
          </Link>
          <h1 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Configurar Asistente de Prospección
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Edita el agente IA que hace las llamadas. Los cambios se sincronizan con Vapi al guardar.
          </p>
          {config && (
            <p className="text-xs text-zinc-400 mt-1">ID Vapi: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{config.id}</code></p>
          )}
        </div>

        {cargando && (
          <div className="py-16 text-center text-sm text-zinc-400">Cargando configuración desde Vapi...</div>
        )}

        {error && !cargando && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {exito && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4 dark:bg-emerald-900/20 dark:border-emerald-800">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ Guardado en Vapi correctamente</p>
            {serverUrl && (
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5 truncate">
                Webhook: {serverUrl}
              </p>
            )}
            {(camposActivos.size + camposPersonalizados.length) > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                Extrayendo {camposActivos.size + camposPersonalizados.length} campos de cada llamada
              </p>
            )}
          </div>
        )}

        {!cargando && config && (
          <form onSubmit={guardar} className="space-y-5">

            {/* Nombre */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Nombre del asistente
              </label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ej: Natalia — Asesora Comercial"
              />
            </div>

            {/* Primer mensaje */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Primer mensaje <span className="text-xs font-normal text-zinc-400">(lo que dice el agente al contestar)</span>
              </label>
              <textarea
                value={primerMensaje}
                onChange={e => setPrimerMensaje(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <p className="mt-1 text-xs text-zinc-400">Este mensaje se anula por el que genera el pipeline para cada lead. Solo aplica si llamas manualmente.</p>
            </div>

            {/* System Prompt */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                System Prompt <span className="text-xs font-normal text-zinc-400">(instrucciones del agente)</span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y font-mono"
              />
            </div>

            {/* Modelo + Webhook */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Modelo IA</label>
                <select
                  value={modelo}
                  onChange={e => setModelo(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {MODELOS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Webhook URL <span className="text-xs font-normal text-zinc-400">(Server URL en Vapi)</span>
                </label>
                <input
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="https://tu-app.com/api/vapi/webhook"
                />
              </div>
            </div>

            {/* Extracción de datos */}
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Datos a extraer de cada llamada
                </p>
                {totalCampos > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {totalCampos} activos
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mb-4">
                Al terminar cada llamada, Vapi extrae estos datos del transcript y los guarda automáticamente.
              </p>

              {/* Campos predefinidos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {CAMPOS_PREDEFINIDOS.map(campo => {
                  const activo = camposActivos.has(campo.nombre);
                  return (
                    <button
                      key={campo.nombre}
                      type="button"
                      onClick={() => toggleCampo(campo.nombre)}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        activo
                          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 hover:border-zinc-300"
                      }`}
                    >
                      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center ${
                        activo ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 dark:border-zinc-600"
                      }`}>
                        {activo && <span className="text-white text-[10px] leading-none">✓</span>}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{campo.label}</span>
                        <span className="block text-[11px] text-zinc-400 truncate">{campo.descripcion}</span>
                        {campo.opciones && (
                          <span className="text-[10px] text-zinc-400">{campo.opciones.join(" · ")}</span>
                        )}
                      </span>
                      <span className="shrink-0 rounded bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {campo.tipo === "boolean" ? "Sí/No" : TIPO_LABEL[campo.tipo]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Campos personalizados */}
              {camposPersonalizados.length > 0 && (
                <div className="mb-3 space-y-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Campos personalizados</p>
                  {camposPersonalizados.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{c.nombre}</span>
                        <span className="block text-[11px] text-zinc-400 truncate">{c.descripcion}</span>
                      </div>
                      <span className="shrink-0 rounded bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">
                        {TIPO_LABEL[c.tipo]}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarCampoPersonalizado(idx)}
                        className="text-zinc-400 hover:text-red-500 text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulario nuevo campo */}
              {mostrarFormCampo ? (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Nuevo campo personalizado</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={nuevoCampoNombre}
                      onChange={e => setNuevoCampoNombre(e.target.value)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="nombre_campo (clave)"
                    />
                    <select
                      value={nuevoCampoTipo}
                      onChange={e => setNuevoCampoTipo(e.target.value as "string" | "boolean" | "number")}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="string">Texto</option>
                      <option value="boolean">Sí / No</option>
                      <option value="number">Número</option>
                    </select>
                  </div>
                  <input
                    value={nuevoCampoDesc}
                    onChange={e => setNuevoCampoDesc(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Descripción para que la IA sepa qué extraer"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={agregarCampoPersonalizado}
                      disabled={!nuevoCampoNombre.trim() || !nuevoCampoDesc.trim()}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarFormCampo(false)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarFormCampo(true)}
                  className="w-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  + Agregar campo personalizado
                </button>
              )}
            </div>

            {/* Guardar */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cargar}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Recargar desde Vapi
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-6 py-2 text-sm font-semibold text-white transition-colors"
              >
                {guardando ? "Guardando..." : "Guardar en Vapi"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
