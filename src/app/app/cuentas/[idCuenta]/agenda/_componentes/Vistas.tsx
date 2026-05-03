"use client";

import { useMemo } from "react";
import type { Cita, EstadoCita } from "@/lib/baseDatos";
import {
  COLOR_BARRA_ESTADO,
  COLOR_ESTADO,
  NOMBRES_DIA,
  NOMBRE_ESTADO,
  formatFechaCorta,
  formatHora,
  inicioDeSemana,
  mismoDia,
} from "./compartido";

export function VistaLista({
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
      {/* Cards — mobile (< lg) */}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 lg:hidden">
        {ordenadas.map((c) => (
          <li key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {formatFechaCorta(c.fecha_hora)} · {formatHora(c.fecha_hora)}
                </p>
                <p className="mt-1 truncate font-semibold">
                  {c.cliente_nombre}
                </p>
                {c.cliente_telefono && (
                  <p className="truncate font-mono text-[10px] text-zinc-500">
                    +{c.cliente_telefono}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${COLOR_ESTADO[c.estado]}`}
              >
                {NOMBRE_ESTADO[c.estado]}
              </span>
            </div>
            {(c.tipo || c.notas) && (
              <div className="mt-2 space-y-0.5 text-xs">
                {c.tipo && <p className="font-medium">{c.tipo}</p>}
                {c.notas && (
                  <p className="text-zinc-500 dark:text-zinc-400">{c.notas}</p>
                )}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-zinc-500">{c.duracion_min} min</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEditar(c)}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-700 dark:hover:bg-zinc-800"
                  title="Editar"
                  aria-label="Editar cita"
                >
                  ✎
                </button>
                {c.estado !== "realizada" && (
                  <button
                    type="button"
                    onClick={() => onCambiarEstado(c.id, "realizada")}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-emerald-700 dark:hover:bg-zinc-800"
                    title="Marcar completada"
                    aria-label="Marcar como completada"
                  >
                    ✓
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onBorrar(c.id)}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40"
                  title="Borrar"
                  aria-label="Borrar cita"
                >
                  🗑
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Tabla — desktop (lg+) */}
      <table className="hidden w-full text-sm lg:table">
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


export function VistaSemana({
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


export function VistaMes({
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


