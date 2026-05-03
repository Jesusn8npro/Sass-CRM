"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Conversacion, Etiqueta, EstadoLead } from "@/lib/baseDatos";

const ESTADOS: { id: EstadoLead; label: string; color: string }[] = [
  { id: "nuevo", label: "Nuevo", color: "zinc" },
  { id: "contactado", label: "Contactado", color: "blue" },
  { id: "calificado", label: "Calificado", color: "violet" },
  { id: "interesado", label: "Interesado", color: "amber" },
  { id: "negociacion", label: "Negociación", color: "orange" },
  { id: "cerrado", label: "Cerrado", color: "emerald" },
  { id: "perdido", label: "Perdido", color: "red" },
];

const COLORES_ETIQUETA = [
  { id: "zinc", clase: "bg-zinc-500" },
  { id: "rojo", clase: "bg-red-500" },
  { id: "ambar", clase: "bg-amber-500" },
  { id: "amarillo", clase: "bg-yellow-500" },
  { id: "esmeralda", clase: "bg-emerald-500" },
  { id: "azul", clase: "bg-blue-500" },
  { id: "violeta", clase: "bg-violet-500" },
  { id: "rosa", clase: "bg-pink-500" },
];

function clasesPillEtiqueta(color: string): string {
  switch (color) {
    case "rojo":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    case "ambar":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "amarillo":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300";
    case "esmeralda":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "azul":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "violeta":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "rosa":
      return "bg-pink-500/15 text-pink-700 dark:text-pink-300";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  }
}

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
      } catch {}
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

          {/* Etiquetas */}
          <Seccion titulo="Etiquetas">
            {asignadas.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {asignadas.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => alternarEtiqueta(e)}
                    title="Quitar etiqueta"
                    className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${clasesPillEtiqueta(e.color)}`}
                  >
                    {e.nombre}
                    <span className="opacity-0 group-hover:opacity-100">×</span>
                  </button>
                ))}
              </div>
            )}
            <details className="rounded-xl border border-zinc-200 bg-white open:bg-zinc-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:open:bg-zinc-950/40">
              <summary className="cursor-pointer rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/40">
                + Agregar etiqueta
              </summary>
              <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
                {/* Existentes */}
                {todasEtiquetas.length > 0 && (
                  <>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Existentes
                    </p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {todasEtiquetas
                        .filter((e) => !idsAsignadas.has(e.id))
                        .map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => alternarEtiqueta(e)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70 transition-opacity hover:opacity-100 ${clasesPillEtiqueta(e.color)}`}
                          >
                            + {e.nombre}
                          </button>
                        ))}
                      {todasEtiquetas.filter((e) => !idsAsignadas.has(e.id)).length === 0 && (
                        <span className="text-[10px] text-zinc-400">
                          (Todas las etiquetas existentes ya están asignadas)
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* Crear nueva */}
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Crear nueva
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={nombreNuevaEt}
                    onChange={(e) => setNombreNuevaEt(e.target.value)}
                    placeholder="Nombre de la etiqueta…"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void crearEtiqueta();
                    }}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COLORES_ETIQUETA.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColorNuevaEt(c.id)}
                        className={`h-5 w-5 rounded-full ${c.clase} ${
                          colorNuevaEt === c.id
                            ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-200"
                            : ""
                        }`}
                        title={c.id}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={crearEtiqueta}
                    disabled={!nombreNuevaEt.trim() || creandoEtiqueta}
                    className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {creandoEtiqueta ? "Creando…" : "+ Crear y asignar"}
                  </button>
                </div>
              </div>
            </details>
          </Seccion>

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

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function Dato({
  label,
  valor,
  mono,
}: {
  label: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span
        className={`truncate text-right text-xs ${mono ? "font-mono" : "font-medium"} text-zinc-700 dark:text-zinc-300`}
      >
        {valor}
      </span>
    </div>
  );
}
