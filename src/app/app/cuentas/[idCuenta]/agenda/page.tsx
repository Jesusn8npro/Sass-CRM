"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Cita, Cuenta, EstadoCita } from "@/lib/baseDatos";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaCitas {
  citas: Cita[];
}

const COLOR_ESTADO: Record<EstadoCita, string> = {
  agendada: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  confirmada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  realizada: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  cancelada: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  no_asistio: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

const COLOR_BARRA_ESTADO: Record<EstadoCita, string> = {
  agendada: "border-l-amber-400 bg-amber-50/70 dark:bg-amber-950/30",
  confirmada: "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30",
  realizada: "border-l-blue-500 bg-blue-50/70 dark:bg-blue-950/30",
  cancelada: "border-l-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/30",
  no_asistio: "border-l-red-500 bg-red-50/70 dark:bg-red-950/30",
};

const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  agendada: "Pendiente",
  confirmada: "Confirmada",
  realizada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

type Vista = "lista" | "semana" | "mes";
type FiltroEstado = "todos" | EstadoCita;

const NOMBRES_DIA = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"] as const;
const NOMBRES_MES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
] as const;

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inicioDeSemana(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay()); // domingo
  return r;
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
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

function rangoSemana(cursor: Date): string {
  const ini = inicioDeSemana(cursor);
  const fin = new Date(ini);
  fin.setDate(ini.getDate() + 6);
  return `${ini.getDate()} ${NOMBRES_MES[ini.getMonth()].slice(0, 3)} – ${fin.getDate()} ${NOMBRES_MES[fin.getMonth()].slice(0, 3)} ${fin.getFullYear()}`;
}

// ============================================================
// Stat Card
// ============================================================

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  accent: "violet" | "emerald" | "amber" | "blue";
}) {
  const ringByAccent: Record<typeof accent, string> = {
    violet: "ring-violet-300/50 dark:ring-violet-500/30 bg-gradient-to-br from-violet-50/70 to-transparent dark:from-violet-950/30",
    emerald: "ring-emerald-300/50 dark:ring-emerald-500/30 bg-gradient-to-br from-emerald-50/70 to-transparent dark:from-emerald-950/30",
    amber: "ring-amber-300/50 dark:ring-amber-500/30 bg-gradient-to-br from-amber-50/70 to-transparent dark:from-amber-950/30",
    blue: "ring-blue-300/50 dark:ring-blue-500/30 bg-gradient-to-br from-blue-50/70 to-transparent dark:from-blue-950/30",
  };
  const iconBg: Record<typeof accent, string> = {
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  };
  return (
    <div className={`rounded-xl bg-white px-4 py-3 ring-1 dark:bg-zinc-900 ${ringByAccent[accent]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${iconBg[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Vista LISTA — tabla estilo Talos
// ============================================================

function VistaLista({
  citas,
  onEditar,
  onCambiarEstado,
  onBorrar,
}: {
  citas: Cita[];
  onEditar: (c: Cita) => void;
  onCambiarEstado: (id: string, e: EstadoCita) => void;
  onBorrar: (id: string) => void;
}) {
  const ordenadas = [...citas].sort(
    (a, b) =>
      new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
            <th className="px-4 py-3">Fecha/Hora</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3">Duración</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((c) => (
            <tr
              key={c.id}
              className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
            >
              <td className="px-4 py-3">
                <p className="font-mono text-xs font-semibold">
                  {formatFechaCorta(c.fecha_hora)}
                </p>
                <p className="font-mono text-[10px] text-zinc-500">
                  {formatHora(c.fecha_hora)}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="truncate font-semibold">{c.cliente_nombre}</p>
                {c.cliente_telefono && (
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    +{c.cliente_telefono}
                  </p>
                )}
              </td>
              <td className="max-w-[280px] px-4 py-3">
                {c.tipo && (
                  <p className="truncate text-xs font-medium">{c.tipo}</p>
                )}
                {c.notas && (
                  <p className="truncate text-[11px] text-zinc-500">
                    {c.notas}
                  </p>
                )}
                {!c.tipo && !c.notas && (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs">{c.duracion_min} min</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${COLOR_ESTADO[c.estado]}`}
                >
                  {NOMBRE_ESTADO[c.estado]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditar(c)}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-700 dark:hover:bg-zinc-800"
                    title="Editar"
                  >
                    ✎
                  </button>
                  {c.estado !== "realizada" && (
                    <button
                      type="button"
                      onClick={() => onCambiarEstado(c.id, "realizada")}
                      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-700 dark:hover:bg-zinc-800"
                      title="Marcar completada"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onBorrar(c.id)}
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
  );
}

// ============================================================
// Vista SEMANA — grid 7 columnas con horas 8-22
// ============================================================

function VistaSemana({
  cursor,
  citas,
  onEditar,
}: {
  cursor: Date;
  citas: Cita[];
  onEditar: (c: Cita) => void;
}) {
  const ini = inicioDeSemana(cursor);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ini);
    d.setDate(ini.getDate() + i);
    return d;
  });
  const horas = Array.from({ length: 15 }, (_, i) => 8 + i); // 8 a 22

  // Indexar citas por dia+hora-bucket
  const citasPorDia = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of citas) {
      const f = new Date(c.fecha_hora);
      const k = `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [citas]);

  const hoy = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header dias */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-zinc-200 dark:border-zinc-800">
        <div className="border-r border-zinc-200 dark:border-zinc-800" />
        {dias.map((d, i) => {
          const esHoy = mismoDia(d, hoy);
          return (
            <div
              key={i}
              className={`border-r border-zinc-200 px-2 py-3 text-center last:border-r-0 dark:border-zinc-800 ${
                esHoy ? "bg-violet-50 dark:bg-violet-950/30" : ""
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {NOMBRES_DIA[d.getDay()]}
              </p>
              <p
                className={`mt-0.5 font-mono text-lg font-bold ${
                  esHoy ? "text-violet-700 dark:text-violet-300" : ""
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Grid hours x days */}
      <div className="max-h-[640px] overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))]">
          {horas.map((h) => (
            <FilaHora
              key={h}
              hora={h}
              dias={dias}
              citasPorDia={citasPorDia}
              hoy={hoy}
              onEditar={onEditar}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilaHora({
  hora,
  dias,
  citasPorDia,
  hoy,
  onEditar,
}: {
  hora: number;
  dias: Date[];
  citasPorDia: Map<string, Cita[]>;
  hoy: Date;
  onEditar: (c: Cita) => void;
}) {
  return (
    <>
      <div className="border-b border-r border-zinc-100 px-2 py-1 text-right font-mono text-[10px] text-zinc-500 dark:border-zinc-800">
        {String(hora).padStart(2, "0")}:00
      </div>
      {dias.map((d, idx) => {
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const enDia = citasPorDia.get(k) ?? [];
        const enHora = enDia.filter((c) => {
          const f = new Date(c.fecha_hora);
          return f.getHours() === hora;
        });
        const esHoy = mismoDia(d, hoy);
        return (
          <div
            key={idx}
            className={`relative h-14 border-b border-r border-zinc-100 last:border-r-0 dark:border-zinc-800 ${
              esHoy ? "bg-violet-50/30 dark:bg-violet-950/10" : ""
            }`}
          >
            {enHora.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onEditar(c)}
                className={`absolute inset-x-1 top-1 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-[10px] shadow-sm transition-all hover:translate-y-[-1px] hover:shadow-md ${COLOR_BARRA_ESTADO[c.estado]}`}
                style={{ height: `${Math.min(c.duracion_min / 60, 4) * 56 - 4}px` }}
              >
                <p className="font-mono font-bold">
                  {formatHora(c.fecha_hora)}
                </p>
                <p className="truncate font-semibold">{c.cliente_nombre}</p>
                {c.tipo && (
                  <p className="truncate text-[9px] opacity-80">{c.tipo}</p>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ============================================================
// Vista MES — grid 6 semanas x 7 dias
// ============================================================

function VistaMes({
  cursor,
  citas,
  onEditar,
}: {
  cursor: Date;
  citas: Cita[];
  onEditar: (c: Cita) => void;
}) {
  const año = cursor.getFullYear();
  const mes = cursor.getMonth();
  const primerDia = new Date(año, mes, 1);
  const inicio = inicioDeSemana(primerDia);
  const dias = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });

  const citasPorDia = useMemo(() => {
    const m = new Map<string, Cita[]>();
    for (const c of citas) {
      const f = new Date(c.fecha_hora);
      const k = `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return m;
  }, [citas]);

  const hoy = new Date();

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header dias */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/60">
        {NOMBRES_DIA.map((n) => (
          <div
            key={n}
            className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500"
          >
            {n}
          </div>
        ))}
      </div>

      {/* Grid 6 weeks x 7 days */}
      <div className="grid grid-cols-7">
        {dias.map((d, i) => {
          const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const items = citasPorDia.get(k) ?? [];
          const esMesActual = d.getMonth() === mes;
          const esHoy = mismoDia(d, hoy);
          return (
            <div
              key={i}
              className={`min-h-[100px] border-b border-r border-zinc-100 p-1.5 last:border-r-0 dark:border-zinc-800 ${
                esMesActual
                  ? esHoy
                    ? "bg-violet-50 dark:bg-violet-950/30"
                    : "bg-white dark:bg-zinc-900"
                  : "bg-zinc-50/40 dark:bg-zinc-950/40"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                    esHoy
                      ? "bg-violet-600 text-white"
                      : esMesActual
                      ? "text-zinc-700 dark:text-zinc-300"
                      : "text-zinc-400"
                  }`}
                >
                  {d.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="text-[9px] font-medium text-zinc-500">
                    {items.length} cita{items.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onEditar(c)}
                    className={`block w-full overflow-hidden rounded-md border-l-2 px-1 py-0.5 text-left text-[9px] hover:translate-y-[-1px] hover:shadow-sm ${COLOR_BARRA_ESTADO[c.estado]}`}
                  >
                    <span className="font-mono font-bold">
                      {formatHora(c.fecha_hora)}
                    </span>{" "}
                    <span className="truncate">{c.tipo || c.cliente_nombre}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="text-center text-[9px] font-medium text-zinc-500">
                    +{items.length - 3} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Modal Editar / Crear cita
// ============================================================

function ModalCita({
  idCuenta,
  citaActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: string;
  citaActual: Cita | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const fechaInicial = citaActual
    ? new Date(citaActual.fecha_hora)
    : new Date(Date.now() + 24 * 3600 * 1000);

  const [nombre, setNombre] = useState(citaActual?.cliente_nombre ?? "");
  const [telefono, setTelefono] = useState(citaActual?.cliente_telefono ?? "");
  const [fecha, setFecha] = useState(fechaInicial.toISOString().slice(0, 10));
  const [hora, setHora] = useState(
    `${String(fechaInicial.getHours()).padStart(2, "0")}:${String(fechaInicial.getMinutes()).padStart(2, "0")}`,
  );
  const [duracion, setDuracion] = useState(citaActual?.duracion_min ?? 30);
  const [tipo, setTipo] = useState(citaActual?.tipo ?? "");
  const [notas, setNotas] = useState(citaActual?.notas ?? "");
  const [estado, setEstado] = useState<EstadoCita>(citaActual?.estado ?? "agendada");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const ms = new Date(`${fecha}T${hora}:00`).getTime();
      const cuerpo = {
        cliente_nombre: nombre.trim(),
        cliente_telefono: telefono.trim() || null,
        fecha_iso: new Date(ms).toISOString(),
        duracion_min: Number(duracion) || 30,
        tipo: tipo.trim() || null,
        notas: notas.trim() || null,
        estado,
      };
      const url = citaActual
        ? `/api/cuentas/${idCuenta}/citas/${citaActual.id}`
        : `/api/cuentas/${idCuenta}/citas`;
      const metodo = citaActual ? "PATCH" : "POST";
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
      onGuardado();
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
      <div className="my-8 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold tracking-tight">
            {citaActual ? "Editar Cita" : "Nueva Cita"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="text-2xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-3 px-5 py-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Título / Motivo *
            </label>
            <input
              type="text"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="ej. Show vallenato — Boda"
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Fecha *
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Hora *
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Duración (minutos)
              </label>
              <select
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoCita)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {Object.entries(NOMBRE_ESTADO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Datos del cliente
            </p>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              required
              className="mb-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+57 300 1234567"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Notas adicionales
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Detalles relevantes para el operador (ciudad, invitados, requerimientos...)"
              className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar Cita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
