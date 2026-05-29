"use client";

/**
 * Panel para conectar el Supabase del negocio del cliente a su cuenta.
 *
 * El cliente pega la URL + service_role key de SU proyecto. Al guardar,
 * el backend valida las credenciales contra ese Supabase y descubre las
 * tablas disponibles. La key nunca vuelve al navegador: solo se muestra
 * si está conectado, la URL y la lista de tablas.
 */
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";

interface ConfigExterno {
  conectado: boolean;
  url: string | null;
  validado_en: string | null;
  tablas: string[];
  agenteHabilitado: boolean;
  tablasPermitidas: string[];
}

export function PanelSupabaseExterno({ idCuenta }: { idCuenta: string }) {
  const [config, setConfig] = useState<ConfigExterno | null>(null);
  const [cargando, setCargando] = useState(true);
  const [url, setUrl] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [habilitado, setHabilitado] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [guardandoAgente, setGuardandoAgente] = useState(false);
  const toast = useToast();
  const { confirmar } = useConfirm();

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/supabase-externo`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as ConfigExterno;
        setConfig(d);
        setHabilitado(d.agenteHabilitado);
        setSeleccionadas(d.tablasPermitidas);
      }
    } finally {
      setCargando(false);
    }
  }

  function alternarTabla(tabla: string) {
    setSeleccionadas((prev) =>
      prev.includes(tabla) ? prev.filter((t) => t !== tabla) : [...prev, tabla],
    );
  }

  async function guardarAgente() {
    setGuardandoAgente(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/supabase-externo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habilitado, tablas_permitidas: seleccionadas }),
      });
      const d = (await res.json().catch(() => ({}))) as ConfigExterno & { error?: string };
      if (res.ok) {
        toast.exito("Configuración del agente guardada");
        setConfig(d);
        setHabilitado(d.agenteHabilitado);
        setSeleccionadas(d.tablasPermitidas);
      } else {
        toast.error(d.error ?? "No se pudo guardar.");
      }
    } finally {
      setGuardandoAgente(false);
    }
  }

  useEffect(() => { void cargar(); }, [idCuenta]); // eslint-disable-line react-hooks/exhaustive-deps

  async function conectar() {
    if (!url.trim() || !serviceKey.trim()) {
      toast.error("Completá la URL y la service_role key.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/supabase-externo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), service_key: serviceKey.trim() }),
      });
      const d = (await res.json().catch(() => ({}))) as ConfigExterno & { error?: string };
      if (res.ok) {
        toast.exito(`Conectado · ${d.tablas?.length ?? 0} tablas detectadas`);
        setServiceKey("");
        setConfig(d);
      } else {
        toast.error(d.error ?? "No se pudo conectar.");
      }
    } finally {
      setGuardando(false);
    }
  }

  async function desconectar() {
    const ok = await confirmar({
      mensaje: "¿Desconectar el Supabase del negocio? El agente dejará de poder consultar esos datos.",
      textoConfirmar: "Desconectar",
      variante: "peligro",
    });
    if (!ok) return;
    const res = await fetch(`/api/cuentas/${idCuenta}/supabase-externo`, { method: "DELETE" });
    if (res.ok) { toast.exito("Desconectado"); void cargar(); }
    else { toast.error("No se pudo desconectar."); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-white via-emerald-50/30 to-white px-6 pt-6 pb-4 dark:border-zinc-800 dark:from-zinc-950 dark:via-emerald-950/10 dark:to-zinc-950">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg text-white shadow-md">🗄️</div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Datos del negocio · Supabase</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Conectá tu Supabase</h1>
            <p className="text-xs text-zinc-500">Conectá la base de datos de tu negocio para que el agente responda con tus datos reales (precios, stock, clientes…).</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-zinc-50/50 px-6 py-5 dark:bg-zinc-950">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : config?.conectado ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">✓</span>
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">Conectado</p>
              </div>
              <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">{config.url}</p>
              <p className="mt-1 text-xs text-zinc-500">{config.tablas.length} tabla(s) detectada(s)</p>
            </div>

            {config.tablas.length > 0 && (
              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Acceso del agente de chat (clientes)</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Solo LECTURA, y solo de las tablas que marques abajo. Sirve para que el agente
                      responda a tus clientes con datos reales (cursos, precios, verificar su registro).
                      ⚠️ No marques tablas sensibles como pagos o transacciones.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={habilitado}
                    onClick={() => setHabilitado((h) => !h)}
                    title={habilitado ? "Tocá para desactivar" : "Tocá para activar"}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                      habilitado
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                        : "border-zinc-300 bg-transparent text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-7 items-center rounded-full px-0.5 transition-colors ${habilitado ? "justify-end bg-white/40" : "justify-start bg-zinc-300 dark:bg-zinc-600"}`}
                    >
                      <span className="h-3 w-3 rounded-full bg-white shadow" />
                    </span>
                    {habilitado ? "Activado" : "Desactivado"}
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Tablas que el agente puede leer
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.tablas.map((t) => {
                      const activa = seleccionadas.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => alternarTabla(t)}
                          disabled={!habilitado}
                          className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors disabled:opacity-40 ${
                            activa
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                              : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {activa ? "✓ " : ""}{t}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-400">Solo lectura. Lo que no marques, el agente no lo consulta.</p>
                </div>

                <button
                  type="button"
                  onClick={() => void guardarAgente()}
                  disabled={guardandoAgente}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {guardandoAgente ? "Guardando…" : "Guardar acceso del agente"}
                </button>
              </div>
            )}

            <button type="button" onClick={() => void desconectar()} className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-950/30">
              Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Usá la service_role key</p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">La encontrás en tu panel de Supabase → Project Settings → API → <strong>service_role</strong>. Da acceso completo a tu base; se guarda cifrada (AES-256) del lado del servidor y nunca se muestra de vuelta.</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">URL del proyecto</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xxxxxxxx.supabase.co"
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">service_role key</span>
                <input
                  type="password"
                  value={serviceKey}
                  onChange={(e) => setServiceKey(e.target.value)}
                  placeholder="eyJhbGciOi…"
                  className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <button
                type="button"
                onClick={() => void conectar()}
                disabled={guardando}
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {guardando ? "Validando…" : "Conectar y validar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
