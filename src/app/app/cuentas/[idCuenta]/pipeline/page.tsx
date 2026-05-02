"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ColumnaPipeline } from "@/components/pipeline/ColumnaPipeline";
import { TarjetaConversacion } from "@/components/pipeline/TarjetaConversacion";
import type {
  ConversacionConPreview,
  Cuenta,
  EtapaPipeline,
} from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaEtapas {
  etapas: EtapaPipeline[];
}
interface RespuestaConversaciones {
  conversaciones: ConversacionConPreview[];
}

const COLORES_VALIDOS = [
  { id: "zinc", clase: "bg-zinc-400" },
  { id: "rojo", clase: "bg-red-500" },
  { id: "ambar", clase: "bg-amber-500" },
  { id: "amarillo", clase: "bg-yellow-500" },
  { id: "esmeralda", clase: "bg-emerald-500" },
  { id: "azul", clase: "bg-blue-500" },
  { id: "violeta", clase: "bg-violet-500" },
  { id: "rosa", clase: "bg-pink-500" },
];

export default function PaginaPipeline() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [etapas, setEtapas] = useState<EtapaPipeline[]>([]);
  const [conversaciones, setConversaciones] = useState<
    ConversacionConPreview[]
  >([]);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [creandoEtapa, setCreandoEtapa] = useState(false);
  const [nombreEtapaNueva, setNombreEtapaNueva] = useState("");
  const [colorEtapaNueva, setColorEtapaNueva] = useState("zinc");

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const cargarTodo = useCallback(async () => {
    if (!idCuenta) return;
    try {
      const [resCuenta, resEtapas, resConvs] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/etapas`, { cache: "no-store" }),
        fetch(`/api/cuentas/${idCuenta}/conversaciones`, {
          cache: "no-store",
        }),
      ]);
      if (resCuenta.ok) {
        const d = (await resCuenta.json()) as RespuestaCuenta;
        setCuenta(d.cuenta);
      }
      if (resEtapas.ok) {
        const d = (await resEtapas.json()) as RespuestaEtapas;
        setEtapas(d.etapas);
      }
      if (resConvs.ok) {
        const d = (await resConvs.json()) as RespuestaConversaciones;
        setConversaciones(d.conversaciones);
      }
    } catch (err) {
      console.error("[pipeline] error cargando:", err);
    }
  }, [idCuenta]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  // Polling suave para que cuando lleguen mensajes nuevos, las tarjetas
  // muevan su preview sin perder el estado del Kanban.
  useEffect(() => {
    const t = setInterval(cargarTodo, 8000);
    return () => clearInterval(t);
  }, [cargarTodo]);

  const conversacionesPorEtapa = useMemo(() => {
    const mapa = new Map<string | "sin", ConversacionConPreview[]>();
    for (const e of etapas) mapa.set(e.id, []);
    mapa.set("sin", []);
    for (const c of conversaciones) {
      const k =
        c.etapa_id != null && etapas.some((e) => e.id === c.etapa_id)
          ? c.etapa_id
          : "sin";
      mapa.get(k)!.push(c);
    }
    return mapa;
  }, [etapas, conversaciones]);

  const conversacionArrastrada = useMemo(
    () => conversaciones.find((c) => c.id === arrastrando) ?? null,
    [arrastrando, conversaciones],
  );

  function alIniciarArrastre(e: DragStartEvent) {
    const id = String(e.active.id);
    if (id) setArrastrando(id);
  }

  async function alTerminarArrastre(e: DragEndEvent) {
    setArrastrando(null);
    if (!e.over) return;
    const idConv = String(e.active.id);
    const idDestino = e.over.id;
    if (!idConv) return;

    const nuevaEtapaId = idDestino === "sin" ? null : String(idDestino);

    // Optimistic update
    setConversaciones((prev) =>
      prev.map((c) =>
        c.id === idConv ? { ...c, etapa_id: nuevaEtapaId } : c,
      ),
    );

    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conversaciones/${idConv}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etapa_id: nuevaEtapaId }),
        },
      );
      if (!res.ok) {
        console.error("[pipeline] error moviendo:", await res.text());
        cargarTodo();
      }
    } catch (err) {
      console.error("[pipeline] error red moviendo:", err);
      cargarTodo();
    }
  }

  async function crearEtapa(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreEtapaNueva.trim() || creandoEtapa) return;
    setCreandoEtapa(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/etapas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreEtapaNueva.trim(),
          color: colorEtapaNueva,
        }),
      });
      if (res.ok) {
        setNombreEtapaNueva("");
        setColorEtapaNueva("zinc");
        await cargarTodo();
      }
    } finally {
      setCreandoEtapa(false);
    }
  }

  async function borrarEtapa(idEtapa: string) {
    if (
      !confirm(
        "¿Borrar esta etapa? Las conversaciones quedan sin etapa (no se borran).",
      )
    )
      return;
    await fetch(`/api/cuentas/${idCuenta}/etapas/${idEtapa}`, {
      method: "DELETE",
    });
    cargarTodo();
  }

  async function renombrarEtapa(idEtapa: string, nuevoNombre: string) {
    const limpio = nuevoNombre.trim();
    if (!limpio) return;
    await fetch(`/api/cuentas/${idCuenta}/etapas/${idEtapa}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: limpio }),
    });
    cargarTodo();
  }

  async function cambiarColorEtapa(idEtapa: string, color: string) {
    await fetch(`/api/cuentas/${idCuenta}/etapas/${idEtapa}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
    cargarTodo();
  }

  const etapasMostradas = etapas;
  const sinEtapaCount = (conversacionesPorEtapa.get("sin") ?? []).length;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Pipeline
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/cuentas/${idCuenta}/dashboard`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Dashboard
            </Link>
            <Link
              href={`/app/cuentas/${idCuenta}/configuracion`}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            >
              Ajustes
            </Link>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="px-4 py-4 md:px-6 md:py-6">
        <DndContext
          sensors={sensores}
          onDragStart={alIniciarArrastre}
          onDragEnd={alTerminarArrastre}
          onDragCancel={() => setArrastrando(null)}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {sinEtapaCount > 0 && (
              <ColumnaPipeline
                idEtapa={"sin"}
                titulo="Sin asignar"
                color="zinc"
                conversaciones={conversacionesPorEtapa.get("sin") ?? []}
                idCuenta={idCuenta}
                deshabilitarEdicion
              />
            )}

            {etapasMostradas.map((etapa) => (
              <ColumnaPipeline
                key={etapa.id}
                idEtapa={etapa.id}
                titulo={etapa.nombre}
                color={etapa.color}
                conversaciones={
                  conversacionesPorEtapa.get(etapa.id) ?? []
                }
                idCuenta={idCuenta}
                onRenombrar={(nuevo) => renombrarEtapa(etapa.id, nuevo)}
                onBorrar={() => borrarEtapa(etapa.id)}
                onCambiarColor={(c) => cambiarColorEtapa(etapa.id, c)}
                colores={COLORES_VALIDOS}
              />
            ))}

            <form
              onSubmit={crearEtapa}
              className="flex h-fit w-72 shrink-0 flex-col gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Nueva etapa
              </p>
              <input
                type="text"
                value={nombreEtapaNueva}
                onChange={(e) => setNombreEtapaNueva(e.target.value)}
                placeholder="Ej: Demo agendada"
                maxLength={40}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <div className="flex flex-wrap gap-1">
                {COLORES_VALIDOS.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setColorEtapaNueva(c.id)}
                    className={`h-5 w-5 rounded-full ${c.clase} ${
                      colorEtapaNueva === c.id
                        ? "ring-2 ring-offset-1 ring-zinc-900 dark:ring-zinc-100"
                        : ""
                    }`}
                    aria-label={c.id}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={!nombreEtapaNueva.trim() || creandoEtapa}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creandoEtapa ? "Creando..." : "Agregar etapa"}
              </button>
            </form>
          </div>

          <DragOverlay>
            {conversacionArrastrada ? (
              <TarjetaConversacion
                conversacion={conversacionArrastrada}
                idCuenta={idCuenta}
                arrastrando
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </main>
  );
}
