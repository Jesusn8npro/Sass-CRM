"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  ConversacionConPreview,
  ContactoEmailConTelefono,
  ContactoTelefonoConContexto,
  EstadoLead,
} from "@/lib/baseDatos";

import {
  BarraScore,
  COLOR_ESTADO,
  type FilaCliente,
  type FiltroEstado,
  LABEL_ESTADO,
  ModalDetalle,
} from "./_componentes";
import { HeroClientes } from "./_hero";

interface RespuestaConvs {
  conversaciones: ConversacionConPreview[];
}
interface RespuestaEmails {
  contactos: ContactoEmailConTelefono[];
}
interface RespuestaTels {
  contactos: ContactoTelefonoConContexto[];
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
      <HeroClientes
        filas={filas}
        filtradas={filtradas}
        filtro={filtro}
        setFiltro={setFiltro}
        exportarCSV={exportarCSV}
        stats={stats}
        estadoFiltro={estadoFiltro}
        setEstadoFiltro={setEstadoFiltro}
        conteoPorEstado={conteoPorEstado}
      />

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
