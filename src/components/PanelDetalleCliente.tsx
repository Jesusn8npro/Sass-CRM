"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Conversacion, Etiqueta, EstadoLead } from "@/lib/baseDatos";
import {
  Dato,
  GestionEtiquetas,
  Seccion,
} from "./PanelDetalleCliente-helpers";

const ESTADOS: { id: EstadoLead; label: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo", color: "zinc" },
  { id: "contactado", label: "Contactado", color: "blue" },
  { id: "calificado", label: "Calificado", color: "violet" },
  { id: "interesado", label: "Interesado", color: "amber" },
  { id: "negociacion", label: "Negociación", color: "orange" },
  { id: "cerrado", label: "Cerrado", color: "emerald" },
  { id: "perdido", label: "Perdido", color: "red" },
];

interface Props {
  abierto: boolean;
  idCuenta: string;
  conversacion: Conversacion;
  onCerrar: () => void;
  onActualizada: (conv: Conversacion) => void;
  onConversacionBorrada: (id: string) => void;
}

export function PanelDetalleCliente({
  abierto,
  idCuenta,
  conversacion,
  onCerrar,
  onActualizada,
  onConversacionBorrada,
}: Props) {
  const [todasEtiquetas, setTodasEtiquetas] = useState<Etiqueta[]>([]);
  const [asignadas, setAsignadas] = useState<Etiqueta[]>([]);
  const [creandoEtiqueta, setCreandoEtiqueta] = useState(false);
  const [nombreNuevaEt, setNombreNuevaEt] = useState("");
  const [colorNuevaEt, setColorNuevaEt] = useState("emerald");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  // Cargar etiquetas (todas + asignadas)
  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    async function cargar() {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/cuentas/${idCuenta}/etiquetas`, { cache: "no-store" }),
          fetch(
            `/api/cuentas/${idCuenta}/conversaciones/${conversacion.id}/etiquetas`,
            { cache: "no-store" },
          ),
        ]);
        if (cancelado) return;
        if (r1.ok) {
          const d = (await r1.json()) as { etiquetas: Etiqueta[] };
          setTodasEtiquetas(d.etiquetas);
        }
        if (r2.ok) {
          const d = (await r2.json()) as { etiquetas: Etiqueta[] };
          setAsignadas(d.etiquetas);
        }
      } catch (err) {
        console.error("[PanelDetalleCliente] cargar etiquetas:", err);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [abierto, idCuenta, conversacion.id]);

  const idsAsignadas = useMemo(
    () => new Set(asignadas.map((e) => e.id)),
    [asignadas],
  );

  async function actualizarEstado(estado: EstadoLead) {
    const res = await fetch(
      `/api/cuentas/${idCuenta}/conversaciones/${conversacion.id}/lead`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_lead: estado }),
      },
    );
    if (res.ok) {
      const d = (await res.json()) as { conversacion: Conversacion };
      onActualizada(d.conversacion);
    }
  }

  async function actualizarScore(score: number) {
    const res = await fetch(
      `/api/cuentas/${idCuenta}/conversaciones/${conversacion.id}/lead`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_score: score }),
      },
    );
    if (res.ok) {
      const d = (await res.json()) as { conversacion: Conversacion };
      onActualizada(d.conversacion);
    }
  }

  async function alternarEtiqueta(et: Etiqueta) {
    const yaTengo = idsAsignadas.has(et.id);
    const url = `/api/cuentas/${idCuenta}/conversaciones/${conversacion.id}/etiquetas`;
    if (yaTengo) {
      await fetch(`${url}?etiqueta_id=${et.id}`, { method: "DELETE" });
      setAsignadas((prev) => prev.filter((e) => e.id !== et.id));
    } else {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta_id: et.id }),
      });
      if (res.ok) setAsignadas((prev) => [...prev, et]);
    }
  }

  async function crearEtiqueta() {
    const nombre = nombreNuevaEt.trim();
    if (!nombre || creandoEtiqueta) return;
    setCreandoEtiqueta(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/etiquetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, color: colorNuevaEt }),
      });
      if (res.ok) {
        const d = (await res.json()) as { etiqueta: Etiqueta };
        setTodasEtiquetas((prev) => [...prev, d.etiqueta]);
        // Auto-asignar la nueva etiqueta a esta conv
        await alternarEtiqueta(d.etiqueta);
        setNombreNuevaEt("");
      }
    } finally {
      setCreandoEtiqueta(false);
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conversaciones/${conversacion.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onConversacionBorrada(conversacion.id);
        onCerrar();
      }
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  }

  const dc = conversacion.datos_capturados ?? {};
  const nombreReal = dc.nombre?.trim() || conversacion.nombre || `+${conversacion.telefono}`;
  const inicial = nombreReal[0]?.toUpperCase() ?? "?";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity ${
          abierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onCerrar}
      />
      {/* Drawer */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl transition-transform dark:bg-zinc-950 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header del drawer */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/90 px-5 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-base font-bold text-white shadow-md">
              {inicial}
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Datos del Cliente
              </h2>
              <p className="font-mono text-[10px] text-zinc-500">
                {nombreReal}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <div className="flex-1 px-5 py-4">
          {/* Estado del Lead */}
          <Seccion titulo="Estado del Lead">
            <select
              value={conversacion.estado_lead ?? "nuevo"}
              onChange={(e) => actualizarEstado(e.target.value as EstadoLead)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-800 dark:bg-zinc-900"
            >
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </Seccion>

          {/* Puntuación */}
          <Seccion titulo="Puntuación">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Lead Score
                </span>
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {conversacion.lead_score ?? 0}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={conversacion.lead_score ?? 0}
                onChange={(e) => actualizarScore(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="mt-1 text-[10px] text-zinc-500">
                Se actualiza automáticamente conforme avanza la conversación.
              </p>
            </div>
          </Seccion>

          {/* Progreso del Paso */}
          <Seccion titulo="Progreso del Paso">
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/40 dark:to-teal-950/40">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Paso actual
              </p>
              <p className="mt-1 text-xl font-bold tracking-tight">
                {conversacion.paso_actual ?? "inicio"}
              </p>
            </div>
          </Seccion>

          {/* Datos Capturados */}
          <Seccion titulo="Datos Capturados">
            <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <Dato
                label="Nombre"
                valor={dc.nombre || conversacion.nombre || "—"}
              />
              <Dato label="Teléfono" valor={`+${conversacion.telefono}`} mono />
              {dc.email && <Dato label="Email" valor={dc.email} mono />}
              {dc.telefono_alt && (
                <Dato label="Tel. alternativo" valor={dc.telefono_alt} mono />
              )}
              {dc.interes && <Dato label="Interés" valor={dc.interes} />}
              {dc.negocio && <Dato label="Negocio" valor={dc.negocio} />}
              {dc.ventajas && <Dato label="Ventajas" valor={dc.ventajas} />}
              {dc.miedos && <Dato label="Miedos / objeciones" valor={dc.miedos} />}
              {dc.otros &&
                Object.entries(dc.otros).map(([k, v]) => (
                  <Dato key={k} label={k} valor={v} />
                ))}
            </div>
          </Seccion>

          <GestionEtiquetas
            asignadas={asignadas}
            todasEtiquetas={todasEtiquetas}
            idsAsignadas={idsAsignadas}
            alternarEtiqueta={alternarEtiqueta}
            nombreNuevaEt={nombreNuevaEt}
            setNombreNuevaEt={setNombreNuevaEt}
            colorNuevaEt={colorNuevaEt}
            setColorNuevaEt={setColorNuevaEt}
            creandoEtiqueta={creandoEtiqueta}
            crearEtiqueta={crearEtiqueta}
          />

          {/* CTA a vista 360 completa */}
          <Link
            href={`/app/cuentas/${idCuenta}/contactos/${conversacion.id}`}
            onClick={onCerrar}
            className="mb-5 flex items-center justify-between rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-violet-500/30 dark:from-violet-950/40 dark:to-indigo-950/40"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm text-white shadow-sm">
                ⊕
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  Vista 360
                </p>
                <p className="text-sm font-bold tracking-tight">
                  Ver perfil completo
                </p>
                <p className="text-[10px] text-zinc-500">
                  Llamadas, productos de interés y estadísticas
                </p>
              </div>
            </div>
            <span className="text-violet-600 dark:text-violet-400">→</span>
          </Link>

          {/* WhatsApp ID + Registrado */}
          <Seccion titulo="Información de la conversación">
            <div className="space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <Dato
                label="WhatsApp ID"
                valor={`+${conversacion.telefono}`}
                mono
              />
              <Dato
                label="Conversación creada"
                valor={new Date(conversacion.creada_en).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </div>
          </Seccion>

          {/* Acciones de borrado */}
          <div className="mt-6 flex flex-col gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            {confirmandoBorrado ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-950/30">
                <p className="mb-2 text-xs font-medium text-red-700 dark:text-red-300">
                  ¿Eliminar permanentemente esta conversación y todos sus
                  mensajes? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrado(false)}
                    className="flex-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={borrar}
                    disabled={borrando}
                    className="flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {borrando ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(true)}
                className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                🗑 Eliminar conversación
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

