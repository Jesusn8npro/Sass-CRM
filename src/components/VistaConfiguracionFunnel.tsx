"use client";

import { useEffect, useState } from "react";
import type { EtapaPipeline } from "@/lib/baseDatos";

interface PlantillaInfo {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  cantidad_pasos: number;
}

const PLANTILLAS_CLIENTE: PlantillaInfo[] = [
  {
    id: "inmobiliaria",
    nombre: "Inmobiliaria / Bienes Raíces",
    descripcion: "Funnel para captación de leads interesados en compra, venta o alquiler de propiedades.",
    icono: "🏠",
    cantidad_pasos: 6,
  },
  {
    id: "ecommerce",
    nombre: "E-commerce / Tienda Online",
    descripcion: "Funnel para atención al cliente de tienda online: consultas, ventas y postventa.",
    icono: "🛒",
    cantidad_pasos: 6,
  },
  {
    id: "servicios_profesionales",
    nombre: "Servicios Profesionales",
    descripcion: "Funnel para captación de clientes de servicios (consultoría, agencia, abogacía).",
    icono: "💼",
    cantidad_pasos: 6,
  },
  {
    id: "educacion",
    nombre: "Educación / Cursos",
    descripcion: "Funnel para inscripción a cursos, talleres y programas educativos.",
    icono: "📚",
    cantidad_pasos: 6,
  },
];

const COLORES_DOT: Record<string, string> = {
  zinc: "bg-zinc-400",
  rojo: "bg-red-500",
  ambar: "bg-amber-500",
  amarillo: "bg-yellow-500",
  esmeralda: "bg-emerald-500",
  azul: "bg-blue-500",
  violeta: "bg-violet-500",
  rosa: "bg-pink-500",
};

interface Props {
  idCuenta: string;
  etapas: EtapaPipeline[];
  onCambio: () => Promise<void> | void;
}

export function VistaConfiguracionFunnel({
  idCuenta,
  etapas,
  onCambio,
}: Props) {
  const [modalPlantillas, setModalPlantillas] = useState(false);
  const [editando, setEditando] = useState<EtapaPipeline | "nuevo" | null>(null);

  // Ordenadas por orden ascendente
  const ordenadas = [...etapas].sort((a, b) => a.orden - b.orden);

  async function aplicarPlantilla(plantillaId: string) {
    const res = await fetch(`/api/cuentas/${idCuenta}/etapas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantilla: plantillaId }),
    });
    if (res.ok) {
      setModalPlantillas(false);
      await onCambio();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      alert(`Error: ${d.error ?? "no se pudo aplicar"}`);
    }
  }

  async function borrarEtapa(id: string) {
    if (!confirm("¿Borrar este paso del funnel?")) return;
    await fetch(`/api/cuentas/${idCuenta}/etapas/${id}`, { method: "DELETE" });
    await onCambio();
  }

  return (
    <div className="space-y-5">
      {/* Header con CTA */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Funnel de Ventas</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Configura el flujo de conversación de tu agente IA paso a paso.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModalPlantillas(true)}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold hover:border-violet-500/30 hover:bg-violet-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-violet-950/30"
          >
            📋 Usar Plantilla
          </button>
          <button
            type="button"
            onClick={() => setEditando("nuevo")}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            + Agregar Paso
          </button>
        </div>
      </div>

      {/* Banner cómo funciona */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            ℹ
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              ¿Cómo funciona?
            </p>
            <p className="mt-0.5 text-xs text-blue-800 dark:text-blue-200">
              El agente IA sigue estos pasos y <strong>rastrea objetivos</strong> en cada
              fase. Aunque el cliente se vaya por las ramas, el agente mantiene el
              enfoque en los objetivos pendientes y avanza automáticamente cuando
              se cumplen.
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de pasos */}
      {ordenadas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-3xl">🎯</p>
          <p className="mt-2 font-semibold">Aún no hay pasos en el funnel</p>
          <p className="mt-1 text-xs text-zinc-500">
            Empezá con una plantilla pre-armada o creá tus propios pasos.
          </p>
          <button
            type="button"
            onClick={() => setModalPlantillas(true)}
            className="mt-4 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
          >
            📋 Ver plantillas
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <th className="w-12 px-4 py-3">Orden</th>
                <th className="px-4 py-3">Paso</th>
                <th className="px-4 py-3">Siguiente</th>
                <th className="px-4 py-3">Criterio de Transición</th>
                <th className="w-24 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((e, idx) => (
                <tr
                  key={e.id}
                  className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-4 py-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 font-mono text-xs font-bold dark:bg-zinc-800">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${COLORES_DOT[e.color] ?? "bg-zinc-400"}`}
                      />
                      <div>
                        <p className="font-semibold">{e.nombre}</p>
                        {e.paso_id && (
                          <p className="font-mono text-[10px] text-zinc-500">
                            {e.paso_id}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {e.paso_siguiente_id ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <span className="text-zinc-400">→</span>
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                          {e.paso_siguiente_id}
                        </span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        Fin del flujo
                      </span>
                    )}
                  </td>
                  <td className="max-w-[400px] px-4 py-3">
                    {e.criterio_transicion?.trim() ? (
                      <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
                        {e.criterio_transicion}
                      </p>
                    ) : (
                      <span className="text-[11px] text-zinc-400">
                        Sin criterio configurado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditando(e)}
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-violet-700 dark:hover:bg-zinc-800"
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => borrarEtapa(e.id)}
                        className="rounded-md p-1.5 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40"
                        title="Borrar"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalPlantillas && (
        <ModalPlantillas
          plantillas={PLANTILLAS_CLIENTE}
          onCerrar={() => setModalPlantillas(false)}
          onAplicar={aplicarPlantilla}
        />
      )}

      {editando && (
        <ModalEditarPaso
          idCuenta={idCuenta}
          etapa={editando === "nuevo" ? null : editando}
          pasosExistentes={ordenadas}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null);
            await onCambio();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal: Seleccionar plantilla de funnel
// ============================================================

function ModalPlantillas({
  plantillas,
  onCerrar,
  onAplicar,
}: {
  plantillas: PlantillaInfo[];
  onCerrar: () => void;
  onAplicar: (id: string) => void | Promise<void>;
}) {
  const [seleccionada, setSeleccionada] = useState<string>(plantillas[0]?.id ?? "");
  const [aplicando, setAplicando] = useState(false);

  async function aplicar() {
    if (!seleccionada || aplicando) return;
    setAplicando(true);
    try {
      await onAplicar(seleccionada);
    } finally {
      setAplicando(false);
    }
  }

  const detalle = plantillas.find((p) => p.id === seleccionada);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Seleccionar plantilla de funnel
            </h2>
            <p className="text-xs text-zinc-500">
              Elegí una estructura base probada y personalizalá según tus
              necesidades.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-[280px_1fr]">
          {/* Lista de plantillas */}
          <div className="border-b border-zinc-100 md:border-b-0 md:border-r dark:border-zinc-800">
            <ul className="space-y-1 p-3">
              {plantillas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccionada(p.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      seleccionada === p.id
                        ? "border-violet-500 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-950/30"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xl">{p.icono}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{p.nombre}</p>
                        <p className="line-clamp-2 text-[10px] text-zinc-500">
                          {p.descripcion}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Preview de la plantilla seleccionada */}
          <div className="px-5 py-4">
            {detalle ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-2xl">{detalle.icono}</span>
                  <h3 className="text-base font-bold tracking-tight">
                    {detalle.nombre}
                  </h3>
                </div>
                <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-400">
                  {detalle.descripcion}
                </p>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Esta plantilla incluye
                  </p>
                  <p className="mt-1 text-sm">
                    <strong className="font-mono text-violet-700 dark:text-violet-300">
                      {detalle.cantidad_pasos} pasos
                    </strong>{" "}
                    pre-configurados con criterios de transición y objetivos a
                    capturar en cada fase.
                  </p>
                </div>
                <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  <strong>Tip:</strong> si ya tenés pasos creados con los mismos
                  IDs, NO se duplican. Las plantillas son aditivas — borrá los
                  pasos viejos antes si querés empezar limpio.
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onCerrar}
            disabled={aplicando}
            className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={aplicando || !seleccionada}
            className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {aplicando ? "Aplicando…" : `Aplicar plantilla ${detalle?.icono ?? ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal: Editar / Crear paso del funnel
// ============================================================

function ModalEditarPaso({
  idCuenta,
  etapa,
  pasosExistentes,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  etapa: EtapaPipeline | null;
  pasosExistentes: EtapaPipeline[];
  onCerrar: () => void;
  onGuardado: () => Promise<void> | void;
}) {
  const [nombre, setNombre] = useState(etapa?.nombre ?? "");
  const [pasoId, setPasoId] = useState(etapa?.paso_id ?? "");
  const [pasoSiguienteId, setPasoSiguienteId] = useState(
    etapa?.paso_siguiente_id ?? "",
  );
  const [criterio, setCriterio] = useState(etapa?.criterio_transicion ?? "");
  const [objetivos, setObjetivos] = useState(etapa?.objetivos ?? "");
  const [descripcion, setDescripcion] = useState(etapa?.descripcion ?? "");
  const [color, setColor] = useState(etapa?.color ?? "zinc");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pasos disponibles para "siguiente" (excluyendo el actual)
  const opcionesSiguiente = pasosExistentes
    .filter((p) => p.id !== etapa?.id)
    .map((p) => p.paso_id)
    .filter((p): p is string => !!p);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = {
        nombre: nombre.trim(),
        color,
        paso_id: pasoId.trim() || null,
        paso_siguiente_id: pasoSiguienteId.trim() || null,
        criterio_transicion: criterio.trim(),
        objetivos: objetivos.trim(),
        descripcion: descripcion.trim(),
      };
      const url = etapa
        ? `/api/cuentas/${idCuenta}/etapas/${etapa.id}`
        : `/api/cuentas/${idCuenta}/etapas`;
      const metodo = etapa ? "PATCH" : "POST";
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      await onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            {etapa ? "Editar Paso del Funnel" : "Nuevo Paso del Funnel"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600"
          >
            ×
          </button>
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Nombre del Paso *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Bienvenida y Calificación"
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                ID del Paso (slug)
              </label>
              <input
                type="text"
                value={pasoId}
                onChange={(e) =>
                  setPasoId(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]+/g, "_"),
                  )
                }
                placeholder="bienvenida"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
              />
              <p className="mt-1 text-[10px] text-zinc-500">
                Identificador interno que la IA usa para referirse al paso.
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Paso Siguiente
            </label>
            <input
              type="text"
              value={pasoSiguienteId}
              onChange={(e) =>
                setPasoSiguienteId(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]+/g, "_"),
                )
              }
              list="pasos-disponibles"
              placeholder="diagnostico (vacío = fin del flujo)"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <datalist id="pasos-disponibles">
              {opcionesSiguiente.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="mt-1 text-[10px] text-zinc-500">
              ID del paso al que avanzar. Si está vacío, este es el último paso del flujo.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Criterio de Transición
            </label>
            <textarea
              value={criterio}
              onChange={(e) => setCriterio(e.target.value)}
              rows={3}
              placeholder="Ej: Avanzar cuando el cliente confirme tipo de evento + fecha + ciudad."
              className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Lenguaje natural — la IA lee esto para decidir cuándo avanzar al
              próximo paso.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Objetivos a cumplir
            </label>
            <input
              type="text"
              value={objetivos}
              onChange={(e) => setObjetivos(e.target.value)}
              placeholder="saludo_hecho,nombre_capturado,intencion_identificada"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <p className="mt-1 text-[10px] text-zinc-500">
              Lista separada por comas. La IA marca cuáles cumplió.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Descripción del Paso
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Qué hace el agente en este paso, qué busca capturar."
              className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Color
            </label>
            <div className="mt-1 flex gap-1.5">
              {Object.entries(COLORES_DOT).map(([id, clase]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setColor(id)}
                  className={`h-6 w-6 rounded-full ${clase} ${
                    color === id
                      ? "ring-2 ring-zinc-900 ring-offset-2 dark:ring-zinc-100"
                      : ""
                  }`}
                  title={id}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium dark:border-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !nombre.trim()}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar Paso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
