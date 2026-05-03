"use client";

import { useState } from "react";
import type { EtapaPipeline } from "@/lib/baseDatos";
import { ModalPlantillas, ModalEditarPaso } from "./VistaConfiguracionFunnel-modales";

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

