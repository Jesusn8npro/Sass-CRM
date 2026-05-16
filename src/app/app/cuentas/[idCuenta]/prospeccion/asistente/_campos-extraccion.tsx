"use client";

import { useState } from "react";

export interface CampoExtraccion {
  nombre: string;
  descripcion: string;
  tipo: "string" | "boolean" | "number";
  opciones?: string[];
}

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

export const NOMBRES_PREDEFINIDOS = new Set(CAMPOS_PREDEFINIDOS.map(c => c.nombre));

const TIPO_LABEL: Record<string, string> = { string: "Texto", boolean: "Sí / No", number: "Número" };

export function obtenerCamposParaEnviar(
  camposActivos: Set<string>,
  camposPersonalizados: CampoExtraccion[],
): CampoExtraccion[] {
  const predefinidos = CAMPOS_PREDEFINIDOS
    .filter(c => camposActivos.has(c.nombre))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ label, ...rest }) => rest);
  return [...predefinidos, ...camposPersonalizados];
}

interface Props {
  camposActivos: Set<string>;
  onToggleCampo: (nombre: string) => void;
  camposPersonalizados: CampoExtraccion[];
  onAgregarPersonalizado: (campo: CampoExtraccion) => void;
  onEliminarPersonalizado: (idx: number) => void;
}

export function CamposExtraccion({ camposActivos, onToggleCampo, camposPersonalizados, onAgregarPersonalizado, onEliminarPersonalizado }: Props) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<"string" | "boolean" | "number">("string");

  const totalCampos = camposActivos.size + camposPersonalizados.length;

  function agregar() {
    const clave = nombre.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!clave || !desc.trim()) return;
    onAgregarPersonalizado({ nombre: clave, descripcion: desc.trim(), tipo });
    setNombre(""); setDesc(""); setTipo("string"); setMostrarForm(false);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Datos a extraer de cada llamada</p>
        {totalCampos > 0 && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {totalCampos} activos
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-400 mb-4">Al terminar cada llamada, Vapi extrae estos datos del transcript y los guarda automáticamente.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {CAMPOS_PREDEFINIDOS.map(campo => {
          const activo = camposActivos.has(campo.nombre);
          return (
            <button
              key={campo.nombre}
              type="button"
              onClick={() => onToggleCampo(campo.nombre)}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${activo ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20" : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 hover:border-zinc-300"}`}
            >
              <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center ${activo ? "border-emerald-500 bg-emerald-500" : "border-zinc-300 dark:border-zinc-600"}`}>
                {activo && <span className="text-white text-[10px] leading-none">✓</span>}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{campo.label}</span>
                <span className="block text-[11px] text-zinc-400 truncate">{campo.descripcion}</span>
                {campo.opciones && <span className="text-[10px] text-zinc-400">{campo.opciones.join(" · ")}</span>}
              </span>
              <span className="shrink-0 rounded bg-zinc-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                {campo.tipo === "boolean" ? "Sí/No" : TIPO_LABEL[campo.tipo]}
              </span>
            </button>
          );
        })}
      </div>

      {camposPersonalizados.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Campos personalizados</p>
          {camposPersonalizados.map((c, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-3 py-2">
              <div className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{c.nombre}</span>
                <span className="block text-[11px] text-zinc-400 truncate">{c.descripcion}</span>
              </div>
              <span className="shrink-0 rounded bg-blue-100 dark:bg-blue-800 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">{TIPO_LABEL[c.tipo]}</span>
              <button type="button" onClick={() => onEliminarPersonalizado(idx)} className="text-zinc-400 hover:text-red-500 text-sm leading-none">×</button>
            </div>
          ))}
        </div>
      )}

      {mostrarForm ? (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 bg-zinc-50 dark:bg-zinc-800/50">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Nuevo campo personalizado</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="nombre_campo (clave)" />
            <select value={tipo} onChange={e => setTipo(e.target.value as "string" | "boolean" | "number")} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="string">Texto</option>
              <option value="boolean">Sí / No</option>
              <option value="number">Número</option>
            </select>
          </div>
          <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Descripción para que la IA sepa qué extraer" />
          <div className="flex gap-2">
            <button type="button" onClick={agregar} disabled={!nombre.trim() || !desc.trim()} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white">Agregar</button>
            <button type="button" onClick={() => setMostrarForm(false)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setMostrarForm(true)} className="w-full rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
          + Agregar campo personalizado
        </button>
      )}
    </div>
  );
}
