"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Cita, Cuenta, EstadoCita } from "@/lib/baseDatos";
import {
  FiltroEstado,
  NOMBRES_MES,
  StatCard,
  Vista,
  inicioDeSemana,
  mismoDia,
  rangoSemana,
} from "./_componentes/compartido";
import { ModalCita } from "./_componentes/ModalCita";
import { VistaLista, VistaMes, VistaSemana } from "./_componentes/Vistas";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaCitas {
  citas: Cita[];
}

export default function PaginaAgenda() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cita | null>(null);

  const cargar = useCallback(async () => {
    if (!idCuenta) return;
    const [resCuenta, resC] = await Promise.all([
      fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" }),
      fetch(`/api/cuentas/${idCuenta}/citas`, { cache: "no-store" }),
    ]);
    if (resCuenta.ok) {
      const d = (await resCuenta.json()) as RespuestaCuenta;
      setCuenta(d.cuenta);
    }
    if (resC.ok) {
      const d = (await resC.json()) as RespuestaCitas;
      setCitas(d.citas);
    }
  }, [idCuenta]);

  useEffect(() => {
    void cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  // Stats hero
  const stats = useMemo(() => {
    const ahora = new Date();
    const hoy = new Date(ahora);
    hoy.setHours(0, 0, 0, 0);
    const semanaIni = inicioDeSemana(ahora);
    const semanaFin = new Date(semanaIni);
    semanaFin.setDate(semanaIni.getDate() + 7);

    let cHoy = 0;
    let cSemana = 0;
    let cPendientes = 0;
    let cCompletadas = 0;
    for (const c of citas) {
      const f = new Date(c.fecha_hora);
      if (mismoDia(f, hoy)) cHoy++;
      if (f >= semanaIni && f < semanaFin) cSemana++;
      if (c.estado === "agendada" || c.estado === "confirmada") {
        if (f >= ahora) cPendientes++;
      }
      if (c.estado === "realizada") cCompletadas++;
    }
    return { cHoy, cSemana, cPendientes, cCompletadas };
  }, [citas]);

  // Filtros aplicados
  const citasFiltradas = useMemo(() => {
    if (filtroEstado === "todos") return citas;
    return citas.filter((c) => c.estado === filtroEstado);
  }, [citas, filtroEstado]);

  async function cambiarEstado(id: string, estado: EstadoCita) {
    await fetch(`/api/cuentas/${idCuenta}/citas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    void cargar();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta cita?")) return;
    await fetch(`/api/cuentas/${idCuenta}/citas/${id}`, { method: "DELETE" });
    void cargar();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-white via-emerald-50/30 to-white px-6 pt-6 pb-4 dark:border-zinc-800 dark:from-zinc-950 dark:via-emerald-950/10 dark:to-zinc-950">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                Agenda · {cuenta?.etiqueta ?? "—"}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Agenda de citas
              </h1>
              <p className="text-xs text-zinc-500">
                Gestiona las citas agendadas con tus clientes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setModalAbierto(true);
              }}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              + Nueva Cita
            </button>
          </div>

          {/* Stats cards */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Hoy" value={stats.cHoy} icon="📅" accent="violet" />
            <StatCard
              label="Esta semana"
              value={stats.cSemana}
              icon="📋"
              accent="emerald"
            />
            <StatCard
              label="Pendientes"
              value={stats.cPendientes}
              icon="⏱"
              accent="amber"
            />
            <StatCard
              label="Completadas"
              value={stats.cCompletadas}
              icon="✓"
              accent="blue"
            />
          </div>

          {/* Toggle Lista/Semana/Mes + nav cursor + filtro estado */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              {(["lista", "semana", "mes"] as Vista[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVista(v)}
                  className={`rounded-full px-3.5 py-1 text-[11px] font-semibold capitalize transition-all ${
                    vista === v
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {v === "lista" ? "☰ Lista" : v === "semana" ? "📅 Semana" : "🗓 Mes"}
                </button>
              ))}
            </div>

            {vista !== "lista" && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(cursor);
                    if (vista === "semana") d.setDate(d.getDate() - 7);
                    else d.setMonth(d.getMonth() - 1);
                    setCursor(d);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setHours(0, 0, 0, 0);
                    setCursor(d);
                  }}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(cursor);
                    if (vista === "semana") d.setDate(d.getDate() + 7);
                    else d.setMonth(d.getMonth() + 1);
                    setCursor(d);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  ›
                </button>
                <span className="ml-2 text-sm font-semibold">
                  {vista === "semana"
                    ? rangoSemana(cursor)
                    : `${NOMBRES_MES[cursor.getMonth()]} ${cursor.getFullYear()}`}
                </span>
              </div>
            )}

            <div className="ml-auto">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-medium dark:border-zinc-800 dark:bg-zinc-900"
              >
                <option value="todos">Todos</option>
                <option value="agendada">Pendientes</option>
                <option value="confirmada">Confirmadas</option>
                <option value="realizada">Completadas</option>
                <option value="cancelada">Canceladas</option>
                <option value="no_asistio">No asistió</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Body — vista actual */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 px-6 py-5 dark:bg-zinc-950">
        {citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">Aún no hay citas en la agenda</p>
            <p className="mt-1 text-xs text-zinc-500">
              La IA agenda automáticamente cuando un cliente confirma fecha y
              hora. También podés agregar manualmente con &quot;+ Nueva
              cita&quot;.
            </p>
          </div>
        ) : vista === "lista" ? (
          <VistaLista
            citas={citasFiltradas}
            onEditar={(c) => {
              setEditando(c);
              setModalAbierto(true);
            }}
            onCambiarEstado={cambiarEstado}
            onBorrar={borrar}
          />
        ) : vista === "semana" ? (
          <VistaSemana
            cursor={cursor}
            citas={citasFiltradas}
            onEditar={(c) => {
              setEditando(c);
              setModalAbierto(true);
            }}
          />
        ) : (
          <VistaMes
            cursor={cursor}
            citas={citasFiltradas}
            onEditar={(c) => {
              setEditando(c);
              setModalAbierto(true);
            }}
          />
        )}
      </div>

      {modalAbierto && (
        <ModalCita
          idCuenta={idCuenta}
          citaActual={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}
