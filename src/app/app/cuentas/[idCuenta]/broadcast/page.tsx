"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import type { ConversacionConPreview, EstadoLead } from "@/lib/baseDatos";

const LIMITE_CONTACTOS = 100;

const ESTADOS_LEAD: EstadoLead[] = [
  "nuevo", "contactado", "calificado", "interesado", "negociacion", "cerrado", "perdido",
];

const COLORES_ESTADO: Record<EstadoLead, string> = {
  nuevo:       "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  contactado:  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  calificado:  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  interesado:  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  negociacion: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  cerrado:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  perdido:     "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

interface BroadcastLog {
  id: string;
  texto: string;
  total_destinatarios: number;
  total_enviados: number;
  total_fallos: number;
  estado: string;
  programado_para: string | null;
  creado_en: string;
}

function iniciales(nombre: string | null, telefono: string) {
  const base = nombre?.trim() || telefono;
  return base.slice(0, 2).toUpperCase();
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaginaBroadcast() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = params?.idCuenta ?? "";

  const [tab, setTab] = useState<"enviar" | "historial">("enviar");
  const [conversaciones, setConversaciones] = useState<ConversacionConPreview[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoLead | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [texto, setTexto] = useState("");
  const [programadoPara, setProgramadoPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    enviados?: number;
    fallos?: number;
    programado?: boolean;
    programadoPara?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [offsetContactos, setOffsetContactos] = useState(0);
  const [hayMasContactos, setHayMasContactos] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [cargandoLogs, setCargandoLogs] = useState(false);

  useEffect(() => {
    if (!idCuenta) return;
    fetch(
      `/api/cuentas/${idCuenta}/conversaciones?limite=${LIMITE_CONTACTOS}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { conversaciones: ConversacionConPreview[] } | null) => {
        if (d?.conversaciones) {
          setConversaciones(d.conversaciones);
          setHayMasContactos(d.conversaciones.length === LIMITE_CONTACTOS);
          setOffsetContactos(LIMITE_CONTACTOS);
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [idCuenta]);

  const cargarMasContactos = useCallback(async () => {
    if (!idCuenta || !hayMasContactos || cargandoMas) return;
    setCargandoMas(true);
    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/conversaciones?limite=${LIMITE_CONTACTOS}&offset=${offsetContactos}`,
        { cache: "no-store", signal: AbortSignal.timeout(15_000) },
      );
      if (r.ok) {
        const d = (await r.json()) as { conversaciones: ConversacionConPreview[] };
        if (d.conversaciones.length > 0) {
          setConversaciones((prev) => [...prev, ...d.conversaciones]);
          setOffsetContactos((prev) => prev + LIMITE_CONTACTOS);
          setHayMasContactos(d.conversaciones.length === LIMITE_CONTACTOS);
        } else {
          setHayMasContactos(false);
        }
      }
    } catch {
      // silencioso — el usuario puede volver a intentar
    } finally {
      setCargandoMas(false);
    }
  }, [idCuenta, hayMasContactos, cargandoMas, offsetContactos]);

  useEffect(() => {
    if (tab !== "historial" || !idCuenta) return;
    setCargandoLogs(true);
    fetch(`/api/cuentas/${idCuenta}/broadcast`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { logs: BroadcastLog[] } | null) => {
        if (d?.logs) setLogs(d.logs);
      })
      .catch(() => {})
      .finally(() => setCargandoLogs(false));
  }, [tab, idCuenta]);

  const filtradas = useMemo(() => {
    let lista = conversaciones;
    if (filtroEstado) lista = lista.filter((c) => c.estado_lead === filtroEstado);
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      lista = lista.filter(
        (c) =>
          (c.nombre ?? "").toLowerCase().includes(q) ||
          c.telefono.includes(q),
      );
    }
    return lista;
  }, [conversaciones, filtroEstado, busqueda]);

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function seleccionarTodos() {
    if (seleccionados.size === filtradas.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(filtradas.map((c) => c.id)));
    }
  }

  async function enviar() {
    if (seleccionados.size === 0 || !texto.trim()) return;
    setEnviando(true);
    setResultado(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        conversacionIds: [...seleccionados],
        texto: texto.trim(),
      };
      if (programadoPara) body.programadoPara = programadoPara;

      const res = await fetch(`/api/cuentas/${idCuenta}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        enviados?: number;
        fallos?: number;
        programado?: boolean;
        programadoPara?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error desconocido");
      } else {
        setResultado({
          enviados: data.enviados,
          fallos: data.fallos,
          programado: data.programado,
          programadoPara: data.programadoPara,
        });
        setTexto("");
        setProgramadoPara("");
        setSeleccionados(new Set());
      }
    } catch {
      setError("Error de red al enviar");
    } finally {
      setEnviando(false);
    }
  }

  const todosSeleccionados = filtradas.length > 0 && seleccionados.size === filtradas.length;

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Ventas</p>
            <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Broadcast Masivo</h1>
          </div>
          <div className="flex gap-1 rounded-full border border-zinc-200 p-0.5 dark:border-zinc-800">
            {(["enviar", "historial"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {t === "enviar" ? "Enviar" : "Historial"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">

        {/* ── TAB: ENVIAR ── */}
        {tab === "enviar" && (
          <div className="flex flex-col gap-6 lg:flex-row">

            {/* Panel izquierdo: Filtros y destinatarios */}
            <div className="flex flex-col gap-4 lg:w-[55%]">
              <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300">
                <span className="shrink-0">⚠</span>
                <span>WhatsApp puede marcar tu número por spam si enviás mensajes masivos no solicitados. Usá esta función con responsabilidad.</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFiltroEstado(null)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filtroEstado === null
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  Todos
                </button>
                {ESTADOS_LEAD.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setFiltroEstado(filtroEstado === e ? null : e)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                      filtroEstado === e
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Buscar por nombre o teléfono…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />

              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={seleccionarTodos}
                    className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {todosSeleccionados ? "Deseleccionar todos" : `Seleccionar los ${filtradas.length}`}
                  </button>
                  <span className="text-xs text-zinc-500">
                    {seleccionados.size} sel. · {conversaciones.length} cargados
                    {hayMasContactos ? " (hay más)" : ""}
                  </span>
                </div>

                {cargando ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  </div>
                ) : filtradas.length === 0 ? (
                  <p className="py-10 text-center text-sm text-zinc-400">Sin conversaciones que coincidan</p>
                ) : (
                  <ul className="max-h-[420px] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
                    {filtradas.map((conv) => (
                      <li key={conv.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(conv.id)}
                            onChange={() => toggleSeleccion(conv.id)}
                            className="h-4 w-4 rounded accent-emerald-500"
                          />
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-[10px] font-bold text-white">
                            {iniciales(conv.nombre, conv.telefono)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {conv.nombre ?? `+${conv.telefono}`}
                            </p>
                            <p className="font-mono text-[10px] text-zinc-500">+{conv.telefono}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {conv.etiquetas.slice(0, 2).map((et) => (
                              <span
                                key={et.id}
                                className="rounded-full px-1.5 py-px text-[9px] font-semibold"
                                style={{ background: `${et.color}22`, color: et.color }}
                              >
                                {et.nombre}
                              </span>
                            ))}
                            <span className={`rounded-full px-2 py-px text-[9px] font-semibold uppercase ${COLORES_ESTADO[conv.estado_lead]}`}>
                              {conv.estado_lead}
                            </span>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {hayMasContactos && !cargando && (
                  <div className="border-t border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={cargarMasContactos}
                      disabled={cargandoMas}
                      className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
                    >
                      {cargandoMas ? "Cargando…" : "Cargar más contactos →"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Panel derecho: Componer */}
            <div className="flex flex-col gap-4 lg:w-[45%]">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Componer mensaje</h2>

                <div className="relative">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={4096}
                    placeholder="Escribí el mensaje que querés enviar a todos los contactos seleccionados…"
                    rows={8}
                    className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <span className="absolute bottom-2 right-2 text-[10px] text-zinc-400">
                    {texto.length}/4096
                  </span>
                </div>

                {/* Programación horaria */}
                <div className="mt-3">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Programar envío (opcional)
                  </label>
                  <input
                    type="datetime-local"
                    value={programadoPara}
                    onChange={(e) => setProgramadoPara(e.target.value)}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  {programadoPara && (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Se enviará el{" "}
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatearFecha(programadoPara)}
                      </span>
                      {" · "}
                      <button type="button" onClick={() => setProgramadoPara("")} className="text-red-500 underline">
                        Quitar
                      </button>
                    </p>
                  )}
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  Se enviará a{" "}
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{seleccionados.size}</span>{" "}
                  contacto{seleccionados.size !== 1 ? "s" : ""}
                </p>

                {resultado && (
                  <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300">
                    {resultado.programado
                      ? `✓ Broadcast programado para el ${formatearFecha(resultado.programadoPara ?? "")}`
                      : `✓ ${resultado.enviados ?? 0} enviados${(resultado.fallos ?? 0) > 0 ? `, ${resultado.fallos} fallaron` : ""}`}
                  </div>
                )}

                {error && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={enviando ? undefined : enviar}
                  disabled={seleccionados.size === 0 || !texto.trim() || enviando}
                  className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enviando
                    ? "Procesando…"
                    : programadoPara
                    ? "Programar broadcast"
                    : "Enviar ahora"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: HISTORIAL ── */}
        {tab === "historial" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500">Últimas 50 campañas enviadas o programadas.</p>

            {cargandoLogs ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                Todavía no enviaste ningún broadcast.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Mensaje</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Dest.</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Enviados</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fallos</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Estado</th>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {logs.map((l) => (
                      <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">{l.texto}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-zinc-700 dark:text-zinc-300">
                          {l.total_destinatarios}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-emerald-700 dark:text-emerald-400">
                          {l.total_enviados}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {l.total_fallos > 0
                            ? <span className="text-red-600 dark:text-red-400">{l.total_fallos}</span>
                            : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            l.estado === "completado"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                          }`}>
                            {l.estado}
                          </span>
                          {l.estado === "pendiente" && l.programado_para && (
                            <p className="mt-0.5 text-[10px] text-zinc-400">{formatearFecha(l.programado_para)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {formatearFecha(l.creado_en)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
