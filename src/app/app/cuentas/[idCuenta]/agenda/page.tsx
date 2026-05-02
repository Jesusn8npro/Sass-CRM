"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Cita, Cuenta, EstadoCita } from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";

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

const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

function formatearFechaHora(unix: number): string {
  return new Date(unix * 1000).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diaCorto(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function PaginaAgenda() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = Number(params?.idCuenta);

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cita | null>(null);

  const cargar = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
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
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  async function cambiarEstado(id: number, estado: EstadoCita) {
    await fetch(`/api/cuentas/${idCuenta}/citas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    cargar();
  }

  async function borrar(id: number) {
    if (!confirm("¿Borrar esta cita?")) return;
    await fetch(`/api/cuentas/${idCuenta}/citas/${id}`, { method: "DELETE" });
    cargar();
  }

  // Agrupar por día
  const ahora = Math.floor(Date.now() / 1000);
  const futuras = citas.filter((c) => c.fecha_hora >= ahora - 3600);
  const pasadas = citas.filter((c) => c.fecha_hora < ahora - 3600);

  const porDia = new Map<string, Cita[]>();
  for (const c of futuras) {
    const dia = diaCorto(c.fecha_hora);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push(c);
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-6 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Agenda
              </p>
              <h1 className="truncate text-base font-semibold tracking-tight text-zinc-900 md:text-lg dark:text-zinc-100">
                {cuenta?.etiqueta ?? "—"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(null);
                setModalAbierto(true);
              }}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400"
            >
              + Nueva cita
            </button>
            <InterruptorTema />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {citas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Aún no hay citas en la agenda
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              La IA agenda automáticamente cuando un cliente confirma fecha y
              hora. También podés agregar manualmente con &quot;+ Nueva
              cita&quot;.
            </p>
          </div>
        ) : (
          <>
            {Array.from(porDia).map(([dia, items]) => (
              <section key={dia} className="mb-5">
                <h2 className="mb-2 text-sm font-semibold capitalize text-zinc-700 dark:text-zinc-300">
                  {dia}
                </h2>
                <ul className="flex flex-col gap-2">
                  {items.map((c) => (
                    <CitaItem
                      key={c.id}
                      cita={c}
                      onEditar={() => {
                        setEditando(c);
                        setModalAbierto(true);
                      }}
                      onCambiarEstado={(e) => cambiarEstado(c.id, e)}
                      onBorrar={() => borrar(c.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {pasadas.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 text-sm font-semibold text-zinc-500">
                  Histórico ({pasadas.length})
                </h2>
                <ul className="flex flex-col gap-2 opacity-70">
                  {pasadas.slice(0, 20).map((c) => (
                    <CitaItem
                      key={c.id}
                      cita={c}
                      onEditar={() => {
                        setEditando(c);
                        setModalAbierto(true);
                      }}
                      onCambiarEstado={(e) => cambiarEstado(c.id, e)}
                      onBorrar={() => borrar(c.id)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {modalAbierto && (
        <ModalCita
          idCuenta={idCuenta}
          citaActual={editando}
          onCerrar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </main>
  );
}

function CitaItem({
  cita,
  onEditar,
  onCambiarEstado,
  onBorrar,
}: {
  cita: Cita;
  onEditar: () => void;
  onCambiarEstado: (e: EstadoCita) => void;
  onBorrar: () => void;
}) {
  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {formatearFechaHora(cita.fecha_hora)}
            </p>
            <span className="text-[11px] text-zinc-500">
              {cita.duracion_min} min
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                COLOR_ESTADO[cita.estado]
              }`}
            >
              {NOMBRE_ESTADO[cita.estado]}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
            <strong>{cita.cliente_nombre}</strong>
            {cita.cliente_telefono && (
              <span className="ml-2 font-mono text-[11px] text-zinc-500">
                +{cita.cliente_telefono}
              </span>
            )}
          </p>
          {cita.tipo && (
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              {cita.tipo}
            </p>
          )}
          {cita.notas && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              {cita.notas}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px]">
          <select
            value={cita.estado}
            onChange={(e) => onCambiarEstado(e.target.value as EstadoCita)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] dark:border-zinc-800 dark:bg-zinc-900"
          >
            {Object.entries(NOMBRE_ESTADO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onEditar}
              className="text-zinc-500 hover:underline"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onBorrar}
              className="text-red-600 hover:underline dark:text-red-400"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function ModalCita({
  idCuenta,
  citaActual,
  onCerrar,
  onGuardado,
}: {
  idCuenta: number;
  citaActual: Cita | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const fechaInicial = citaActual
    ? new Date(citaActual.fecha_hora * 1000)
    : new Date(Date.now() + 24 * 3600 * 1000);

  const [nombre, setNombre] = useState(citaActual?.cliente_nombre ?? "");
  const [telefono, setTelefono] = useState(
    citaActual?.cliente_telefono ?? "",
  );
  const [fecha, setFecha] = useState(fechaInicial.toISOString().slice(0, 10));
  const [hora, setHora] = useState(
    fechaInicial.toTimeString().slice(0, 5),
  );
  const [duracion, setDuracion] = useState(citaActual?.duracion_min ?? 30);
  const [tipo, setTipo] = useState(citaActual?.tipo ?? "");
  const [notas, setNotas] = useState(citaActual?.notas ?? "");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    if (!nombre.trim()) {
      setError("El nombre es obligatorio");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {citaActual ? "Editar cita" : "Nueva cita"}
        </h2>
        <form onSubmit={guardar} className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Cliente
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Nombre completo"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="5491123456789"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Fecha
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Hora
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Duración (min)
              </label>
              <input
                type="number"
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                min={5}
                max={480}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Tipo
              </label>
              <input
                type="text"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                placeholder="Demo, asesoría..."
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Notas
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Detalles relevantes"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
