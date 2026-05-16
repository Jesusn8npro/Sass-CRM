"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePollingVisible } from "@/components/usePollingVisible";

interface ConteosPipeline {
  conteos: Record<string, number>;
  total: number;
  contactados: number;
  llamadas_ultima_hora: number;
  limite_hora: number;
  modo_prueba: boolean;
}

interface Lead {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  categoria: string | null;
  estado_prospeccion: string;
  metodo_contacto: string | null;
  intentos_outreach: number;
  prospeccion_actualizado_en: string;
}

const ETIQUETA_ESTADO: Record<string, { label: string; color: string }> = {
  nuevo:          { label: "Nuevo",          color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" },
  en_cola:        { label: "En cola",        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  llamado:        { label: "Llamado",        color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  emaileado:      { label: "Email enviado",  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  completado:     { label: "Completado",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  no_contactable: { label: "Sin contacto",   color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  fallido:        { label: "Fallido",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export default function PaginaProspeccion() {
  const params = useParams();
  const idCuenta = params.idCuenta as string;

  const [stats, setStats] = useState<ConteosPipeline | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [disparando, setDisparando] = useState(false);
  const [mensajePrueba, setMensajePrueba] = useState<string | null>(null);
  const [telefonoPrueba, setTelefonoPrueba] = useState("");

  const cargarStats = useCallback(async () => {
    const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/stats`);
    if (r.ok) setStats(await r.json() as ConteosPipeline);
  }, [idCuenta]);

  const cargarLeads = useCallback(async () => {
    const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/leads`);
    if (r.ok) {
      const d = await r.json() as { leads: Lead[] };
      setLeads(d.leads);
    }
  }, [idCuenta]);

  usePollingVisible(() => {
    void cargarStats();
    void cargarLeads();
  }, 15_000);

  async function dispararPrueba() {
    setDisparando(true);
    setMensajePrueba(null);
    const r = await fetch(`/api/cuentas/${idCuenta}/prospeccion/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefonoPrueba: telefonoPrueba.trim() || undefined }),
    });
    const data = await r.json() as { mensaje?: string; error?: string };
    setMensajePrueba(data.mensaje ?? data.error ?? "Error desconocido");
    setDisparando(false);
    await cargarStats();
    await cargarLeads();
  }

  const s = stats;
  const pendientes = (s?.conteos.nuevo ?? 0) + (s?.conteos.en_cola ?? 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Pipeline de prospección</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              El orquestador procesa leads nuevos cada 5 minutos de forma automática.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="tel"
              value={telefonoPrueba}
              onChange={(e) => setTelefonoPrueba(e.target.value)}
              placeholder="+5491112345678"
              className="h-9 w-44 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              onClick={() => void dispararPrueba()}
              disabled={disparando}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {disparando ? "Disparando…" : "🧪 Probar llamada"}
            </button>
            <Link
              href={`/app/cuentas/${idCuenta}/leads`}
              className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-300"
            >
              + Buscar más leads →
            </Link>
          </div>
        </div>

        {/* Banner modo prueba */}
        {s?.modo_prueba && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            ⚠️ <strong>Modo prueba activo</strong> — todas las llamadas van a tu número de prueba.
            Cambiá <code className="font-mono">OUTREACH_TEST_MODE=false</code> para llamadas reales.
          </div>
        )}

        {mensajePrueba && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            {mensajePrueba}
          </div>
        )}

        {/* KPIs */}
        {s && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <TarjetaStat titulo="Total leads" valor={s.total} color="zinc" />
            <TarjetaStat titulo="Por contactar" valor={pendientes} color="blue" />
            <TarjetaStat titulo="Contactados" valor={s.contactados} color="emerald" />
            <TarjetaStat titulo="Llamadas/hora" valor={`${s.llamadas_ultima_hora}/${s.limite_hora}`} color="purple" />
          </div>
        )}

        {/* Barra de estados */}
        {s && s.total > 0 && (
          <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {Object.entries(ETIQUETA_ESTADO).map(([estado, { label }]) => (
              <div key={estado} className="rounded-lg border border-zinc-200 bg-white p-3 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{s.conteos[estado] ?? 0}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Links a secciones */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href={`/app/cuentas/${idCuenta}/prospeccion/llamadas`}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-emerald-500/30 hover:bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="text-2xl">📞</span>
            <div>
              <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Llamadas</p>
              <p className="text-xs text-zinc-400">Grabaciones, transcripciones y datos capturados</p>
            </div>
          </Link>
          <Link
            href={`/app/cuentas/${idCuenta}/prospeccion/correos`}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-emerald-500/30 hover:bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="text-2xl">✉️</span>
            <div>
              <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Correos enviados</p>
              <p className="text-xs text-zinc-400">Secuencias de 3 emails por lead</p>
            </div>
          </Link>
          <Link
            href={`/app/cuentas/${idCuenta}/prospeccion/asistente`}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-emerald-500/30 hover:bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">Asistente VAPI</p>
              <p className="text-xs text-zinc-400">Script, prompt, campos de extracción</p>
            </div>
          </Link>
        </div>

        {/* Tabla de leads */}
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Leads en pipeline ({leads.length})
            </h2>
          </div>

          {leads.length === 0 ? (
            <div className="py-16 text-center text-sm text-zinc-400">
              <p className="text-4xl mb-3">🎯</p>
              <p className="font-medium">No hay leads en el pipeline aún.</p>
              <p className="mt-1">
                <Link href={`/app/cuentas/${idCuenta}/leads`} className="text-emerald-600 hover:underline dark:text-emerald-400">
                  Buscá leads con Apify
                </Link>{" "}
                y usá el botón <strong>🚀 Iniciar</strong> para arrancar el outreach.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                    <th className="px-4 py-2">Negocio</th>
                    <th className="px-4 py-2">Contacto</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Intentos</th>
                    <th className="px-4 py-2">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const estado = ETIQUETA_ESTADO[lead.estado_prospeccion];
                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">{lead.nombre}</p>
                          {lead.categoria && <p className="text-xs text-zinc-400">{lead.categoria}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          {lead.telefono ? (
                            <span className="text-emerald-600 dark:text-emerald-400">📞 {lead.telefono}</span>
                          ) : lead.email ? (
                            <span className="text-purple-600 dark:text-purple-400">✉️ {lead.email}</span>
                          ) : (
                            <span className="text-zinc-400">Sin contacto</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estado?.color ?? ""}`}>
                            {estado?.label ?? lead.estado_prospeccion}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-zinc-500">{lead.intentos_outreach}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400">{formatearFecha(lead.prospeccion_actualizado_en)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaStat({ titulo, valor, color }: {
  titulo: string;
  valor: number | string;
  color: "zinc" | "blue" | "emerald" | "purple";
}) {
  const colores = {
    zinc:    "text-zinc-800 dark:text-zinc-100",
    blue:    "text-blue-700 dark:text-blue-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    purple:  "text-purple-700 dark:text-purple-300",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${colores[color]}`}>{valor}</p>
    </div>
  );
}
