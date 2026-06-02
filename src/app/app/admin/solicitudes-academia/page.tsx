"use client";

import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/Toaster";
import { usePollingVisible } from "@/components/usePollingVisible";

interface Solicitud {
  id: string;
  nombre: string | null;
  whatsapp: string;
  email: string | null;
  ciudad: string | null;
  que_quiere_aprender: string | null;
  nivel_acordeon: string | null;
  productos_consultados: string[] | null;
  nivel_interes: number | null;
  pagina_origen: string | null;
  mensaje_sugerido: string | null;
  estado: "pendiente" | "enviado" | "descartado" | "error";
  error_envio: string | null;
  created_at: string;
  enviado_at: string | null;
}

const FILTROS = ["pendiente", "enviado", "descartado", "error", ""] as const;
const ETIQUETA_FILTRO: Record<string, string> = {
  pendiente: "Pendientes", enviado: "Enviadas", descartado: "Descartadas", error: "Con error", "": "Todas",
};
const COLOR_ESTADO: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  enviado: "bg-green-100 text-green-800",
  descartado: "bg-gray-100 text-gray-600",
  error: "bg-red-100 text-red-800",
};

export default function PaginaSolicitudesAcademia() {
  const { exito, error: toastError } = useToast();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [filtro, setFiltro] = useState<string>("pendiente");
  const [cargando, setCargando] = useState(true);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const qs = filtro ? `?estado=${filtro}` : "";
      const r = await fetch(`/api/admin/solicitudes-academia${qs}`);
      const j = await r.json();
      setSolicitudes(j.solicitudes || []);
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  usePollingVisible(cargar, 15000);

  const accion = async (id: string, accion: "enviar" | "descartar", mensaje?: string) => {
    setOcupado(id);
    try {
      const r = await fetch(`/api/admin/solicitudes-academia/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, mensaje }),
      });
      const j = await r.json();
      if (!r.ok) {
        toastError(j?.detalle || j?.error || "No se pudo completar la acción");
      } else {
        exito(accion === "enviar" ? "WhatsApp enviado ✅" : "Solicitud descartada");
        await cargar();
      }
    } catch {
      toastError("Error de red");
    } finally {
      setOcupado(null);
    }
  };

  const fmt = (s: string) => new Date(s).toLocaleString("es-CO");
  const pendientes = useMemo(() => solicitudes.filter((s) => s.estado === "pendiente").length, [solicitudes]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900">📲 Leads de Academia</h1>
        <button onClick={cargar} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">
          🔄 Actualizar
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">
        Leads del chat de Academia Vallenata que dejaron WhatsApp y no compraron. Revisa y envíales un mensaje de seguimiento.
        {pendientes > 0 && <strong className="text-amber-700"> · {pendientes} pendientes</strong>}
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f || "todas"}
            onClick={() => setFiltro(f)}
            className={`text-sm px-3 py-1.5 rounded-full border ${
              filtro === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300"
            }`}
          >
            {ETIQUETA_FILTRO[f]}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-gray-400">Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <p className="text-gray-400 py-10 text-center">No hay solicitudes en este filtro.</p>
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => {
            const msg = editado[s.id] ?? s.mensaje_sugerido ?? "";
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-gray-900">{s.nombre || "Sin nombre"}</strong>
                      <span className="text-sm text-gray-500">📱 {s.whatsapp}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR_ESTADO[s.estado] || ""}`}>
                        {s.estado}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {s.email ? `✉️ ${s.email} · ` : ""}
                      {s.que_quiere_aprender ? `🎯 ${s.que_quiere_aprender} · ` : ""}
                      {s.nivel_acordeon ? `nivel ${s.nivel_acordeon} · ` : ""}
                      {fmt(s.created_at)}
                    </div>
                    {s.error_envio && <div className="text-xs text-red-600 mt-1">⚠️ {s.error_envio}</div>}
                  </div>
                </div>

                {s.estado === "pendiente" || s.estado === "error" ? (
                  <>
                    <textarea
                      className="w-full mt-3 p-2.5 border border-gray-300 rounded-lg text-sm"
                      rows={3}
                      value={msg}
                      onChange={(e) => setEditado((p) => ({ ...p, [s.id]: e.target.value }))}
                      placeholder="Mensaje a enviar por WhatsApp…"
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button
                        onClick={() => accion(s.id, "descartar")}
                        disabled={ocupado === s.id}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => accion(s.id, "enviar", msg)}
                        disabled={ocupado === s.id || !msg.trim()}
                        className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        {ocupado === s.id ? "Enviando…" : "📤 Enviar WhatsApp"}
                      </button>
                    </div>
                  </>
                ) : (
                  s.mensaje_sugerido && <p className="text-sm text-gray-600 mt-2 italic">“{s.mensaje_sugerido}”</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
