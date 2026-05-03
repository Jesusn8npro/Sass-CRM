"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  ConversacionConPreview,
  ContactoEmailConTelefono,
  ContactoTelefonoConContexto,
  EstadoLead,
} from "@/lib/baseDatos";

interface RespuestaConvs {
  conversaciones: ConversacionConPreview[];
}
interface RespuestaEmails {
  contactos: ContactoEmailConTelefono[];
}
interface RespuestaTels {
  contactos: ContactoTelefonoConContexto[];
}

type FiltroEstado = "todos" | EstadoLead;

const ESTADOS: { id: FiltroEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nuevo", label: "Nuevos" },
  { id: "contactado", label: "Contactados" },
  { id: "calificado", label: "Calificados" },
  { id: "interesado", label: "Interesados" },
  { id: "negociacion", label: "Negociación" },
  { id: "cerrado", label: "Cerrados" },
  { id: "perdido", label: "Perdidos" },
];

const COLOR_ESTADO: Record<EstadoLead, string> = {
  nuevo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  contactado: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  calificado: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  interesado: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  negociacion: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  cerrado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

const LABEL_ESTADO: Record<EstadoLead, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  interesado: "Interesado",
  negociacion: "Negociación",
  cerrado: "Cerrado",
  perdido: "Perdido",
};

interface FilaCliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  telefonoExtra: string | null;
  modo: "IA" | "HUMANO";
  necesitaHumano: boolean;
  etiquetas: { id: string; nombre: string; color: string }[];
  ultimoMensaje: string | null;
  preview: string | null;
  leadScore: number;
  estadoLead: EstadoLead;
  pasoActual: string;
  datosCapturados: ConversacionConPreview["datos_capturados"];
}

export default function PaginaClientes() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [convs, setConvs] = useState<ConversacionConPreview[]>([]);
  const [emails, setEmails] = useState<ContactoEmailConTelefono[]>([]);
  const [tels, setTels] = useState<ContactoTelefonoConContexto[]>([]);
  const [filtro, setFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>("todos");
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState<FilaCliente | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`/api/cuentas/${idCuenta}/conversaciones`, {
            cache: "no-store",
          }),
          fetch(`/api/cuentas/${idCuenta}/contactos-email`, {
            cache: "no-store",
          }),
          fetch(`/api/cuentas/${idCuenta}/contactos-telefono`, {
            cache: "no-store",
          }),
        ]);
        if (cancelado) return;
        if (r1.ok) {
          const d = (await r1.json()) as RespuestaConvs;
          setConvs(d.conversaciones);
        }
        if (r2.ok) {
          const d = (await r2.json()) as RespuestaEmails;
          setEmails(d.contactos);
        }
        if (r3.ok) {
          const d = (await r3.json()) as RespuestaTels;
          setTels(d.contactos);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    void cargar();
    // Auto-refresh cada 8s para ver datos capturados llegando en vivo.
    const intv = setInterval(cargar, 8000);
    return () => {
      cancelado = true;
      clearInterval(intv);
    };
  }, [idCuenta]);

  const filas: FilaCliente[] = useMemo(() => {
    const mapaEmail = new Map<string, string>();
    for (const e of emails) {
      if (e.conversacion_id && !mapaEmail.has(e.conversacion_id)) {
        mapaEmail.set(e.conversacion_id, e.email);
      }
    }
    const mapaTelExtra = new Map<string, string>();
    for (const t of tels) {
      if (t.conversacion_id && !mapaTelExtra.has(t.conversacion_id)) {
        mapaTelExtra.set(t.conversacion_id, t.telefono);
      }
    }
    return convs.map((c) => {
      // Preferir nombre capturado por IA si existe.
      const nombreCapturado = c.datos_capturados?.nombre?.trim();
      const nombre =
        nombreCapturado || c.nombre?.trim() || `+${c.telefono}`;
      const email =
        c.datos_capturados?.email?.trim() ||
        mapaEmail.get(c.id) ||
        null;
      return {
        id: c.id,
        nombre,
        telefono: `+${c.telefono}`,
        email,
        telefonoExtra:
          c.datos_capturados?.telefono_alt?.trim() ||
          mapaTelExtra.get(c.id) ||
          null,
        modo: c.modo,
        necesitaHumano: c.necesita_humano,
        etiquetas: c.etiquetas,
        ultimoMensaje: c.ultimo_mensaje_en,
        preview: c.vista_previa_ultimo_mensaje,
        leadScore: c.lead_score ?? 0,
        estadoLead: (c.estado_lead ?? "nuevo") as EstadoLead,
        pasoActual: c.paso_actual ?? "inicio",
        datosCapturados: c.datos_capturados ?? {},
      };
    });
  }, [convs, emails, tels]);

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (estadoFiltro !== "todos" && f.estadoLead !== estadoFiltro) {
        return false;
      }
      if (filtro) {
        const q = filtro.toLowerCase();
        return (
          f.nombre.toLowerCase().includes(q) ||
          f.telefono.includes(q) ||
          (f.email?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [filas, estadoFiltro, filtro]);

  function exportarCSV() {
    const filasCSV = [
      [
        "Nombre",
        "Telefono",
        "Email",
        "Estado_lead",
        "Lead_score",
        "Modo_bot",
        "Negocio",
        "Interes",
        "Ventajas",
        "Miedos",
        "Ultimo_mensaje",
      ],
      ...filtradas.map((f) => [
        f.nombre,
        f.telefono,
        f.email ?? "",
        f.estadoLead,
        String(f.leadScore),
        f.modo,
        f.datosCapturados.negocio ?? "",
        f.datosCapturados.interes ?? "",
        f.datosCapturados.ventajas ?? "",
        f.datosCapturados.miedos ?? "",
        f.ultimoMensaje ?? "",
      ]),
    ];
    const csv = filasCSV
      .map((r) =>
        r.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${idCuenta.slice(0, 8)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Stats — los 5 buckets que muestra Talos.
  const stats = useMemo(() => {
    const total = filas.length;
    const por = (e: EstadoLead) => filas.filter((f) => f.estadoLead === e).length;
    return {
      total,
      calificados: por("calificado"),
      negociacion: por("negociacion"),
      cerrados: por("cerrado"),
      perdidos: por("perdido"),
    };
  }, [filas]);

  const conteoPorEstado = useMemo(() => {
    const m = new Map<FiltroEstado, number>();
    m.set("todos", filas.length);
    for (const f of filas) {
      m.set(f.estadoLead, (m.get(f.estadoLead) ?? 0) + 1);
    }
    return m;
  }, [filas]);

  return (
    <div className="flex h-full flex-col">
      {/* Hero con stats */}
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
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-lg text-white shadow-md">
                <span aria-hidden>👥</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {filas.length} contacto{filas.length === 1 ? "" : "s"}
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  CRM de Clientes
                </h1>
                <p className="text-xs text-zinc-500">
                  Gestiona y visualiza todos tus contactos en un solo lugar
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  ⌕
                </span>
                <input
                  type="text"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="w-64 rounded-full border border-zinc-200 bg-white py-1.5 pl-9 pr-4 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
                />
              </div>
              <button
                type="button"
                onClick={exportarCSV}
                disabled={filtradas.length === 0}
                className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all hover:-translate-y-px hover:border-emerald-500/30 hover:shadow-md disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
              >
                ↓ Exportar
              </button>
            </div>
          </div>

          {/* 5 stat cards estilo Talos */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="Total"
              value={stats.total}
              hint="contactos"
              icon="👥"
              accent="zinc"
            />
            <StatCard
              label="Calificados"
              value={stats.calificados}
              hint="listos para avanzar"
              icon="◎"
              accent="violet"
            />
            <StatCard
              label="Negociación"
              value={stats.negociacion}
              hint="en proceso"
              icon="⚙"
              accent="amber"
            />
            <StatCard
              label="Cerrados"
              value={stats.cerrados}
              hint="¡Ganados!"
              icon="🏆"
              accent="emerald"
            />
            <StatCard
              label="Perdidos"
              value={stats.perdidos}
              hint="oportunidades"
              icon="✗"
              accent="red"
            />
          </div>

          {/* Buscador móvil */}
          <div className="mb-3 md:hidden">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                ⌕
              </span>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
          </div>

          {/* Filtros pill por estado */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Filtrar:
            </span>
            {ESTADOS.map((e) => {
              const activo = estadoFiltro === e.id;
              const count = conteoPorEstado.get(e.id) ?? 0;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEstadoFiltro(e.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                    activo
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                      : "border border-zinc-200 bg-white text-zinc-600 hover:border-emerald-500/40 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {e.label}
                  {count > 0 && (
                    <span className="ml-1.5 font-mono text-[9px] opacity-60">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="ml-auto text-[11px] font-mono text-zinc-500">
              {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </header>

      {/* Tabla */}
      <div className="flex-1 overflow-y-auto bg-zinc-50/50 px-6 py-5 dark:bg-zinc-950">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : filas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">Aún no hay clientes</p>
            <p className="mt-1 text-xs text-zinc-500">
              Cuando alguien escriba a tu WhatsApp, aparecerá acá automáticamente.
            </p>
          </div>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            Ningún cliente matchea los filtros.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <p className="text-xs font-semibold tracking-wide text-zinc-500">
                Lista de Contactos
                <span className="ml-2 font-mono text-zinc-400">
                  · {filtradas.length} resultado{filtradas.length === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Lead Score</th>
                  <th className="px-4 py-3">Bot</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => setSeleccionada(f)}
                    className="group cursor-pointer border-b border-zinc-100 transition-colors last:border-0 hover:bg-emerald-50/30 dark:border-zinc-800 dark:hover:bg-emerald-950/10"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                          {f.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{f.nombre}</p>
                          <p className="truncate font-mono text-[10px] text-zinc-500">
                            {f.telefono.replace(/^\+/, "")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {f.email ? (
                        <p className="font-mono text-zinc-700 dark:text-zinc-300">
                          ✉ {f.email}
                        </p>
                      ) : (
                        <p className="text-zinc-400">— sin email</p>
                      )}
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                        ☎ {f.telefono}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${COLOR_ESTADO[f.estadoLead]}`}
                      >
                        {LABEL_ESTADO[f.estadoLead]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BarraScore valor={f.leadScore} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          f.necesitaHumano || f.modo === "HUMANO"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            f.necesitaHumano || f.modo === "HUMANO"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {f.necesitaHumano || f.modo === "HUMANO"
                          ? "Humano"
                          : "Activo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {seleccionada && (
        <ModalDetalle
          cliente={seleccionada}
          onCerrar={() => setSeleccionada(null)}
          idCuenta={idCuenta}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  icon: string;
  accent: "zinc" | "violet" | "amber" | "emerald" | "red";
}) {
  const ringByAccent: Record<typeof accent, string> = {
    zinc: "ring-zinc-200 dark:ring-zinc-800",
    violet: "ring-violet-300/50 dark:ring-violet-500/30 bg-gradient-to-br from-violet-50 to-transparent dark:from-violet-950/30",
    amber: "ring-amber-300/50 dark:ring-amber-500/30 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/30",
    emerald: "ring-emerald-300/50 dark:ring-emerald-500/30 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/30",
    red: "ring-red-300/50 dark:ring-red-500/30 bg-gradient-to-br from-red-50 to-transparent dark:from-red-950/30",
  };
  const iconBg: Record<typeof accent, string> = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    red: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  };
  return (
    <div className={`rounded-xl bg-white px-4 py-3 ring-1 backdrop-blur dark:bg-zinc-900 ${ringByAccent[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">
            {value.toLocaleString("es-AR")}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${iconBg[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function BarraScore({ valor }: { valor: number }) {
  const v = Math.max(0, Math.min(100, valor));
  const color =
    v < 20
      ? "bg-zinc-300 dark:bg-zinc-700"
      : v < 40
      ? "bg-blue-400"
      : v < 60
      ? "bg-amber-400"
      : v < 80
      ? "bg-orange-500"
      : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-zinc-600 dark:text-zinc-400">
        {v}%
      </span>
    </div>
  );
}

function ModalDetalle({
  cliente,
  onCerrar,
  idCuenta,
}: {
  cliente: FilaCliente;
  onCerrar: () => void;
  idCuenta: string;
}) {
  const dc = cliente.datosCapturados ?? {};
  const otros = dc.otros && Object.keys(dc.otros).length > 0 ? dc.otros : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-base font-bold text-white shadow-md">
              {cliente.nombre.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {cliente.nombre}
              </h2>
              <p className="font-mono text-xs text-zinc-500">
                {cliente.telefono}
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

        {/* Estado + Score */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Estado
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${COLOR_ESTADO[cliente.estadoLead]}`}
            >
              {LABEL_ESTADO[cliente.estadoLead]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pt-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:from-violet-950/40 dark:to-indigo-950/40">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
              Lead Score
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-tight">
              {cliente.leadScore}%
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/40 dark:to-teal-950/40">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Paso Actual
            </p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">
              {cliente.pasoActual}
            </p>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="px-6 pt-5">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Información de contacto
          </h3>
          <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            {cliente.email ? (
              <p className="flex items-center gap-2 text-sm">
                <span className="text-emerald-500">✉</span>
                <span className="font-mono">{cliente.email}</span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <span>✉</span>
                <span>Email no capturado todavía</span>
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <span className="text-emerald-500">☎</span>
              <span className="font-mono">{cliente.telefono}</span>
            </p>
            {cliente.telefonoExtra && (
              <p className="flex items-center gap-2 text-sm">
                <span className="text-emerald-500">☎</span>
                <span className="font-mono">{cliente.telefonoExtra}</span>
                <span className="text-[10px] text-zinc-500">(alt)</span>
              </p>
            )}
          </div>
        </div>

        {/* Datos del negocio / lead profile */}
        {(dc.negocio || dc.interes || dc.ventajas || dc.miedos || otros) && (
          <div className="px-6 pt-5">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Perfil del lead (capturado por IA)
            </h3>
            <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              {dc.negocio && (
                <CampoLead label="Negocio" valor={dc.negocio} />
              )}
              {dc.interes && (
                <CampoLead label="Interés" valor={dc.interes} />
              )}
              {dc.ventajas && (
                <CampoLead label="Ventajas que valora" valor={dc.ventajas} />
              )}
              {dc.miedos && (
                <CampoLead label="Miedos / objeciones" valor={dc.miedos} />
              )}
              {otros &&
                Object.entries(otros).map(([k, v]) => (
                  <CampoLead key={k} label={k} valor={v} />
                ))}
            </div>
          </div>
        )}

        {/* Estado del bot */}
        <div className="px-6 pt-5">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Estado del Bot
          </h3>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="text-sm font-semibold">
              {cliente.necesitaHumano || cliente.modo === "HUMANO"
                ? "Atendido por humano"
                : "Bot activo"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {cliente.necesitaHumano
                ? "El cliente necesita atención humana"
                : cliente.modo === "HUMANO"
                ? "Modo humano activo manualmente"
                : "Sin intervención humana"}
            </p>
          </div>
        </div>

        {/* Etiquetas */}
        {cliente.etiquetas.length > 0 && (
          <div className="px-6 pt-5">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {cliente.etiquetas.map((et) => (
                <span
                  key={et.id}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium dark:bg-zinc-800"
                >
                  {et.nombre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer con CTA */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Cerrar
          </button>
          <Link
            href={`/app/cuentas/${idCuenta}/conversaciones?conv=${cliente.id}`}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Abrir conversación →
          </Link>
        </div>
      </div>
    </div>
  );
}

function CampoLead({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="text-sm">{valor}</p>
    </div>
  );
}
