"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  ConversacionConPreview,
  ContactoEmailConTelefono,
  ContactoTelefonoConContexto,
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

/**
 * Página /clientes — vista CRM de contactos.
 *
 * Combina conversaciones (lo que vino por WhatsApp) + emails y
 * teléfonos capturados en una sola tabla. Filtros por modo / etapa
 * + exportar CSV.
 */
export default function PaginaClientes() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [convs, setConvs] = useState<ConversacionConPreview[]>([]);
  const [emails, setEmails] = useState<ContactoEmailConTelefono[]>([]);
  const [tels, setTels] = useState<ContactoTelefonoConContexto[]>([]);
  const [filtro, setFiltro] = useState("");
  const [modoFiltro, setModoFiltro] = useState<"todos" | "IA" | "HUMANO">(
    "todos",
  );
  const [cargando, setCargando] = useState(true);

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
    return () => {
      cancelado = true;
    };
  }, [idCuenta]);

  // Combinar: cada conversación es un cliente. Le agregamos email/tel
  // capturados para esa misma conv.
  const filas = useMemo(() => {
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
    return convs.map((c) => ({
      id: c.id,
      nombre: c.nombre ?? `+${c.telefono}`,
      telefono: `+${c.telefono}`,
      email: mapaEmail.get(c.id) ?? null,
      telefonoExtra: mapaTelExtra.get(c.id) ?? null,
      modo: c.modo,
      necesitaHumano: c.necesita_humano,
      etiquetas: c.etiquetas,
      ultimoMensaje: c.ultimo_mensaje_en,
      preview: c.vista_previa_ultimo_mensaje,
    }));
  }, [convs, emails, tels]);

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (modoFiltro !== "todos" && f.modo !== modoFiltro) return false;
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
  }, [filas, modoFiltro, filtro]);

  function exportarCSV() {
    const filas = [
      ["Nombre", "Telefono", "Email", "Modo", "Necesita_humano", "Ultimo_mensaje"],
      ...filtradas.map((f) => [
        f.nombre,
        f.telefono,
        f.email ?? "",
        f.modo,
        f.necesitaHumano ? "si" : "no",
        f.ultimoMensaje ?? "",
      ]),
    ];
    const csv = filas
      .map((r) => r.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${idCuenta.slice(0, 8)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Stats hero
  const stats = useMemo(() => {
    const total = filas.length;
    const conEmail = filas.filter((f) => !!f.email).length;
    const necesitanHumano = filas.filter((f) => f.necesitaHumano).length;
    const enIA = filas.filter((f) => f.modo === "IA").length;
    return { total, conEmail, necesitanHumano, enIA };
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
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                CRM · Contactos
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                Clientes
              </h1>
            </div>
            <button
              type="button"
              onClick={exportarCSV}
              disabled={filtradas.length === 0}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all hover:-translate-y-px hover:border-emerald-500/30 hover:shadow-md disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900"
            >
              ↓ Exportar CSV
            </button>
          </div>

          {/* Stats */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total contactos" value={stats.total} />
            <StatCard
              label="Con email capturado"
              value={stats.conEmail}
              accent="emerald"
            />
            <StatCard
              label="En modo IA"
              value={stats.enIA}
              accent="emerald"
            />
            <StatCard
              label="Esperando humano"
              value={stats.necesitanHumano}
              accent={stats.necesitanHumano > 0 ? "amber" : "neutral"}
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 md:max-w-md">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                ⌕
              </span>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar nombre, teléfono o email…"
                className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
              />
            </div>
            <select
              value={modoFiltro}
              onChange={(e) =>
                setModoFiltro(e.target.value as "todos" | "IA" | "HUMANO")
              }
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="todos">Todos los modos</option>
              <option value="IA">Solo IA</option>
              <option value="HUMANO">Solo humano</option>
            </select>
            <span className="ml-auto text-[11px] font-mono text-zinc-500">
              {filtradas.length} de {filas.length}
            </span>
          </div>
        </div>
      </header>

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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Etiquetas</th>
                  <th className="px-4 py-3">Último mensaje</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => (
                  <tr
                    key={f.id}
                    className="group border-b border-zinc-100 transition-colors last:border-0 hover:bg-emerald-50/30 dark:border-zinc-800 dark:hover:bg-emerald-950/10"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                          {f.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{f.nombre}</p>
                          <p className="truncate font-mono text-[10px] text-zinc-500">
                            {f.telefono}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {f.email ? (
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {f.email}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            f.modo === "IA"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              f.modo === "IA" ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {f.modo}
                        </span>
                        {f.necesitaHumano && (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                            Atender
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {f.etiquetas.length === 0 ? (
                          <span className="text-zinc-400">—</span>
                        ) : (
                          f.etiquetas.map((et) => (
                            <span
                              key={et.id}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium dark:bg-zinc-800"
                            >
                              {et.nombre}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {f.preview ? (
                        <span className="line-clamp-1">{f.preview}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/cuentas/${idCuenta}/conversaciones?conv=${f.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium opacity-60 transition-all group-hover:border-emerald-500/40 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:opacity-100 dark:border-zinc-700 dark:group-hover:bg-emerald-900/20"
                      >
                        Abrir <span aria-hidden>→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "neutral",
}: {
  label: string;
  value: number;
  accent?: "emerald" | "amber" | "neutral";
}) {
  const ringColor =
    accent === "emerald"
      ? "ring-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent"
      : accent === "amber"
      ? "ring-amber-500/30 bg-gradient-to-br from-amber-500/[0.06] to-transparent"
      : "ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900";
  return (
    <div
      className={`rounded-xl px-4 py-3 ring-1 backdrop-blur ${ringColor}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">
        {value.toLocaleString("es-AR")}
      </p>
    </div>
  );
}
