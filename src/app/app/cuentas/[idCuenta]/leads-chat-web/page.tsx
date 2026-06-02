"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useToast } from "@/components/Toaster";
import { usePollingVisible } from "@/components/usePollingVisible";

interface Lead {
  id: string;
  nombre: string | null;
  email: string | null;
  whatsapp: string | null;
  interes: string | null;
  mensaje: string | null;
  origen_url: string | null;
  mensaje_sugerido: string | null;
  estado: "nuevo" | "enviado" | "descartado" | "error";
  error_envio: string | null;
  created_at: string;
}

const FILTROS = ["", "nuevo", "enviado", "descartado", "error"] as const;
const ETIQUETA: Record<string, string> = {
  nuevo: "Nuevos", enviado: "Enviados", descartado: "Descartados", error: "Con error", "": "Todos",
};
const COLOR: Record<string, string> = {
  nuevo: "bg-amber-100 text-amber-800",
  enviado: "bg-green-100 text-green-800",
  descartado: "bg-gray-100 text-gray-600",
  error: "bg-red-100 text-red-800",
};

export default function PaginaLeadsChatWeb() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const { exito, error: toastError } = useToast();
  const base = `/api/cuentas/${idCuenta}/leads-chat-web`;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verConexion, setVerConexion] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const qs = filtro ? `?estado=${filtro}` : "";
      const r = await fetch(`${base}${qs}`);
      const j = await r.json();
      setLeads(j.leads || []);
      setToken(j.token ?? null);
    } catch {
      /* noop */
    } finally {
      setCargando(false);
    }
  }, [base, filtro]);

  usePollingVisible(cargar, 15000);

  const generarToken = async () => {
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "generar_token" }),
    });
    const j = await r.json();
    if (r.ok) { setToken(j.token); exito("Token generado"); }
    else toastError("No se pudo generar el token");
  };

  const accion = async (id: string, accion: "enviar" | "descartar", mensaje?: string) => {
    setOcupado(id);
    try {
      const r = await fetch(`${base}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, mensaje }),
      });
      const j = await r.json();
      if (!r.ok) toastError(j?.detalle || j?.error || "No se pudo completar");
      else { exito(accion === "enviar" ? "WhatsApp enviado ✅" : "Lead descartado"); await cargar(); }
    } catch {
      toastError("Error de red");
    } finally {
      setOcupado(null);
    }
  };

  const copiar = (txt: string) => {
    navigator.clipboard?.writeText(txt).then(() => exito("Copiado")).catch(() => {});
  };

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/chat-web/lead` : "/api/chat-web/lead";
  const snippet = useMemo(() => {
    const t = token || "TU_TOKEN";
    return `<script>
async function enviarLead(datos){
  await fetch("${endpoint}", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-chat-token": "${t}" },
    body: JSON.stringify({ lead: datos })
  });
}
// Ejemplo: cuando tu chat/formulario capture el contacto:
// enviarLead({ nombre: "Juan", whatsapp: "3001234567", email: "j@mail.com", interes: "curso X", mensaje: "quiere info" });
<\/script>`;
  }, [endpoint, token]);

  const fmt = (s: string) => new Date(s).toLocaleString("es-CO");
  const nuevos = useMemo(() => leads.filter((l) => l.estado === "nuevo").length, [leads]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">💬 Leads Chat Web</h1>
        <div className="flex gap-2">
          <button onClick={() => setVerConexion((v) => !v)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">
            🔌 Conectar mi web
          </button>
          <button onClick={cargar} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">
            🔄 Actualizar
          </button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mt-1 mb-4">
        Leads que tu chat o formulario web nos envía automáticamente. Revísalos y mándales un WhatsApp de seguimiento.
        {nuevos > 0 && <strong className="text-amber-700"> · {nuevos} nuevos</strong>}
      </p>

      {/* Panel de conexión (token + snippet) */}
      {verConexion && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5">
          <h2 className="font-semibold text-indigo-900 mb-1">Conecta tu sitio web en 2 pasos</h2>
          <ol className="text-sm text-indigo-900/80 list-decimal ml-5 mb-3 space-y-0.5">
            <li>Copia tu token y pégalo en el código.</li>
            <li>Pega el código en tu web; cuando tu chat capture un contacto, llama a <code>enviarLead(...)</code>.</li>
          </ol>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-gray-500">Token de esta cuenta:</span>
            {token ? (
              <>
                <code className="text-xs bg-white border border-gray-300 rounded px-2 py-1">{token}</code>
                <button onClick={() => copiar(token)} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white">Copiar</button>
                <button onClick={generarToken} className="text-xs px-2 py-1 rounded border border-gray-300">Rotar</button>
              </>
            ) : (
              <button onClick={generarToken} className="text-xs px-3 py-1 rounded bg-indigo-600 text-white">Generar token</button>
            )}
          </div>
          <div className="relative">
            <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{snippet}</pre>
            <button onClick={() => copiar(snippet)} className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white/10 text-white border border-white/20">Copiar código</button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Endpoint: <code>{endpoint}</code> · campos aceptados: nombre, whatsapp, email, interes, mensaje, origen_url.</p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f || "todos"}
            onClick={() => setFiltro(f)}
            className={`text-sm px-3 py-1.5 rounded-full border ${
              filtro === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300"
            }`}
          >
            {ETIQUETA[f]}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-gray-400">Cargando…</p>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">💬</p>
          <p>Aún no llegan leads de tu chat web.</p>
          <button onClick={() => setVerConexion(true)} className="mt-3 text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white">🔌 Conectar mi web</button>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => {
            const msg = editado[l.id] ?? l.mensaje_sugerido ?? "";
            const accionable = l.estado === "nuevo" || l.estado === "error";
            return (
              <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-gray-900">{l.nombre || "Sin nombre"}</strong>
                  {l.whatsapp && <span className="text-sm text-gray-500">📱 {l.whatsapp}</span>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR[l.estado] || ""}`}>{l.estado}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {l.email ? `✉️ ${l.email} · ` : ""}
                  {l.interes ? `🎯 ${l.interes} · ` : ""}
                  {fmt(l.created_at)}
                  {l.origen_url ? ` · ${l.origen_url}` : ""}
                </div>
                {l.mensaje && <p className="text-sm text-gray-600 mt-1">{l.mensaje}</p>}
                {l.error_envio && <div className="text-xs text-red-600 mt-1">⚠️ {l.error_envio}</div>}

                {accionable && (
                  <>
                    <textarea
                      className="w-full mt-3 p-2.5 border border-gray-300 rounded-lg text-sm"
                      rows={3}
                      value={msg}
                      onChange={(e) => setEditado((p) => ({ ...p, [l.id]: e.target.value }))}
                      placeholder="Mensaje a enviar por WhatsApp…"
                    />
                    <div className="flex gap-2 mt-2 justify-end">
                      <button onClick={() => accion(l.id, "descartar")} disabled={ocupado === l.id}
                        className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        Descartar
                      </button>
                      <button onClick={() => accion(l.id, "enviar", msg)} disabled={ocupado === l.id || !msg.trim() || !l.whatsapp}
                        className="text-sm px-4 py-1.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50">
                        {ocupado === l.id ? "Enviando…" : "📤 Enviar WhatsApp"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
