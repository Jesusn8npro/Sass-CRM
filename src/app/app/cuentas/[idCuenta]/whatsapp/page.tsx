"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Cuenta } from "@/lib/baseDatos";
import { PantallaQR } from "@/components/PantallaQR";
import { useConfirm } from "@/components/ConfirmDialog";
import { Field, RowDato } from "../whatsapp-business/_componentes/helpers";

interface CuentaConEstado extends Cuenta {
  bot_vivo?: boolean;
  qr_png?: string | null;
}
interface RespuestaCuenta {
  cuenta: CuentaConEstado;
}
interface EstadoWA {
  estado: "desconectado" | "verificando" | "conectado" | "error";
  phone_number_id: string | null;
  business_account_id: string | null;
  access_token_preview: string;
  access_token_configurado: boolean;
  app_secret_configurado: boolean;
  verify_token: string;
  verificada_en: string | null;
  ultimo_error: string | null;
}

const ETIQUETA_ESTADO: Record<string, { texto: string; color: string }> = {
  conectado: { texto: "Conectado", color: "bg-emerald-500" },
  qr: { texto: "Esperando escaneo", color: "bg-amber-500" },
  conectando: { texto: "Conectando…", color: "bg-amber-500/70" },
  desconectado: { texto: "Desconectado", color: "bg-zinc-300" },
};

type TabId = "qr" | "meta";

export default function PaginaWhatsApp() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [tab, setTab] = useState<TabId>("qr");

  const [cuenta, setCuenta] = useState<CuentaConEstado | null>(null);
  const [accion, setAccion] = useState(false);
  const [mensajeQR, setMensajeQR] = useState<string | null>(null);
  const { confirmar } = useConfirm();

  const [datos, setDatos] = useState<EstadoWA | null>(null);
  const [editando, setEditando] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [suscribiendo, setSuscribiendo] = useState(false);
  const [mensajeMeta, setMensajeMeta] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function cargarCuenta() {
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as RespuestaCuenta;
        setCuenta(d.cuenta);
      }
    } catch {
      /* ignorar */
    }
  }

  async function cargarMeta() {
    const res = await fetch(`/api/cuentas/${idCuenta}/whatsapp-business`, {
      cache: "no-store",
    });
    if (res.ok) {
      const d = (await res.json()) as EstadoWA;
      setDatos(d);
      setPhoneId(d.phone_number_id ?? "");
      setBusinessId(d.business_account_id ?? "");
    }
  }

  useEffect(() => {
    void cargarCuenta();
    let intervalo: NodeJS.Timeout | null = null;
    const arrancar = () => {
      if (intervalo) clearInterval(intervalo);
      intervalo = setInterval(cargarCuenta, 3500);
    };
    const detener = () => {
      if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        cargarCuenta();
        arrancar();
      } else detener();
    };
    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      detener();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  useEffect(() => {
    if (tab === "meta" && !datos) {
      void cargarMeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function desconectar(opciones: { limpiarAuth: boolean; pausar?: boolean }) {
    const { limpiarAuth, pausar } = opciones;
    const confirmacion = pausar
      ? "Vas a APAGAR la cuenta. El bot deja de responder y NO se va a reconectar hasta que la reactives manualmente. ¿Continuar?"
      : limpiarAuth
      ? "Vas a desconectar y BORRAR la sesión. El bot va a generar un QR nuevo automáticamente. ¿Continuar?"
      : "Desconectar momentáneamente la cuenta?";
    const ok = await confirmar({
      mensaje: confirmacion,
      textoConfirmar: pausar ? "Apagar" : "Desconectar",
      variante: "peligro",
    });
    if (!ok) return;
    setAccion(true);
    setMensajeQR(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conexion/desconectar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pausar: !!pausar }),
      });
      if (res.ok) {
        setMensajeQR(
          pausar
            ? "Cuenta apagada. No se va a reconectar hasta que la reactives."
            : limpiarAuth
            ? "Sesión borrada. El bot genera QR nuevo en unos segundos."
            : "Desconectada.",
        );
        await cargarCuenta();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setMensajeQR("✗ " + (d.error ?? `HTTP ${res.status}`));
      }
    } finally {
      setAccion(false);
    }
  }

  async function reactivar() {
    const ok = await confirmar({
      mensaje: "Reactivar la cuenta? El bot va a generar un QR nuevo para escanear.",
    });
    if (!ok) return;
    setAccion(true);
    setMensajeQR(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ esta_activa: true }),
      });
      if (res.ok) {
        setMensajeQR("Cuenta reactivada. Esperá unos segundos al QR.");
        await cargarCuenta();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setMensajeQR("✗ " + (d.error ?? `HTTP ${res.status}`));
      }
    } finally {
      setAccion(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setMensajeMeta(null);
    try {
      const cuerpo: Record<string, string> = {
        phone_number_id: phoneId,
        business_account_id: businessId,
      };
      if (accessToken) cuerpo.access_token = accessToken;
      if (appSecret) cuerpo.app_secret = appSecret;
      const res = await fetch(`/api/cuentas/${idCuenta}/whatsapp-business`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setMensajeMeta({ tipo: "error", texto: d.error ?? "Error al guardar" });
      } else {
        setMensajeMeta({ tipo: "ok", texto: 'Datos guardados. Tocá "Probar conexión" para verificar.' });
        setEditando(false);
        setAccessToken("");
        setAppSecret("");
        await cargarMeta();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setMensajeMeta(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/whatsapp-business/probar`, { method: "POST" });
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        display_phone_number?: string;
        verified_name?: string;
      };
      if (d.ok) {
        setMensajeMeta({
          tipo: "ok",
          texto: `✓ Conexión exitosa: ${d.verified_name ?? ""} (${d.display_phone_number ?? ""})`,
        });
      } else {
        setMensajeMeta({ tipo: "error", texto: `✗ ${d.error ?? "Error desconocido"}` });
      }
      await cargarMeta();
    } finally {
      setProbando(false);
    }
  }

  async function suscribir() {
    setSuscribiendo(true);
    setMensajeMeta(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/whatsapp-business/suscribir-webhook`, { method: "POST" });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (d.ok) {
        setMensajeMeta({
          tipo: "ok",
          texto: "✓ App suscrita al webhook. Configurá el callback URL desde el panel de Meta.",
        });
      } else {
        setMensajeMeta({ tipo: "error", texto: `✗ ${d.error ?? "Error suscribiendo"}` });
      }
    } finally {
      setSuscribiendo(false);
    }
  }

  if (!cuenta) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando…
      </div>
    );
  }

  const estado = ETIQUETA_ESTADO[cuenta.estado] ?? ETIQUETA_ESTADO.desconectado;

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/wa-cloud/webhook`
      : "/api/wa-cloud/webhook";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          Configuración
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Conexión WhatsApp
        </h1>
      </header>

      <div className="mb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1">
          {(
            [
              { id: "qr", label: "Conexión QR" },
              { id: "meta", label: "API Oficial (Meta)" },
            ] as { id: TabId; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "qr" && (
        <>
          <section
            className={`relative mb-6 overflow-hidden rounded-3xl border p-8 ${
              cuenta.estado === "conectado"
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-teal-950/30"
                : cuenta.estado === "qr" || cuenta.estado === "conectando"
                ? "border-amber-500/30 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/40 dark:via-zinc-900 dark:to-orange-950/30"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
                backgroundSize: "16px 16px",
              }}
            />
            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg ring-2 ${
                      cuenta.estado === "conectado"
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 ring-emerald-300/50"
                        : "bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
                    }`}
                  >
                    {cuenta.estado === "conectado" ? "✓" : "📱"}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {cuenta.etiqueta}
                    </p>
                    <h2 className="text-xl font-bold tracking-tight">
                      {estado!.texto}
                    </h2>
                    {cuenta.telefono && (
                      <p className="mt-0.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        +{cuenta.telefono}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    cuenta.estado === "conectado"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                      : cuenta.estado === "qr" || cuenta.estado === "conectando"
                      ? "bg-amber-500 text-white"
                      : "bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-white ${cuenta.estado === "conectado" || cuenta.estado === "qr" ? "animate-pulse" : ""}`}
                  />
                  {cuenta.estado.toUpperCase()}
                </span>
              </div>

              {cuenta.estado === "qr" || cuenta.estado === "conectando" ? (
                <div className="mt-4">
                  <PantallaQR
                    idCuenta={idCuenta}
                    etiquetaCuenta={cuenta.etiqueta}
                    estado={cuenta.estado}
                    qrPng={cuenta.qr_png ?? null}
                    botVivo={cuenta.bot_vivo ?? false}
                  />
                </div>
              ) : cuenta.estado === "conectado" ? (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                  ✓ Tu WhatsApp está conectado. El bot recibe y responde mensajes
                  automáticamente.
                </div>
              ) : cuenta.esta_activa === false ? (
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                  <p className="mb-1 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Cuenta apagada
                  </p>
                  <p className="mb-4 text-xs text-amber-700 dark:text-amber-300/80">
                    Esta cuenta está pausada. El bot no recibe ni responde mensajes.
                    Reactivala cuando quieras volver a usarla.
                  </p>
                  <button
                    type="button"
                    onClick={reactivar}
                    disabled={accion}
                    className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Reactivar cuenta
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950/50">
                  <p className="mb-3 text-sm text-zinc-500">
                    Para conectar el WhatsApp, generá un QR nuevo y escaneálo con tu
                    teléfono (Configuración → Dispositivos vinculados → Vincular un
                    dispositivo).
                  </p>
                  <button
                    type="button"
                    onClick={() => desconectar({ limpiarAuth: true })}
                    disabled={accion}
                    className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Generar QR
                  </button>
                </div>
              )}
            </div>
          </section>

          {cuenta.estado === "conectado" && (
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-1 text-sm font-semibold">Acciones</h2>
              <p className="mb-5 text-xs text-zinc-500">
                Estas acciones afectan la conexión del bot con tu WhatsApp.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => desconectar({ limpiarAuth: false })}
                  disabled={accion}
                  className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  Regenerar QR (mantener cuenta activa)
                </button>
                <button
                  type="button"
                  onClick={() => desconectar({ limpiarAuth: true, pausar: true })}
                  disabled={accion}
                  className="rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-zinc-950 dark:text-red-300"
                >
                  Apagar cuenta (no reconecta sola)
                </button>
              </div>
              {mensajeQR && (
                <p className="mt-3 text-xs text-zinc-500">{mensajeQR}</p>
              )}
            </section>
          )}

          <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">
              ¿Por qué WhatsApp cierra sesión?
            </p>
            <ul className="mt-2 space-y-1 leading-relaxed">
              <li>• Tener más de 4 dispositivos vinculados al mismo número.</li>
              <li>• 14+ días sin abrir WhatsApp en el móvil principal.</li>
              <li>• Cerrar sesión manualmente desde el celular.</li>
              <li>• Detecciones anti-spam de Meta (envío masivo no humano, etc).</li>
            </ul>
            <p className="mt-3">
              Si esto pasa, recibís una notificación y solo tenés que generar un
              QR nuevo y reescanearlo. Tus conversaciones, contactos y mensajes
              quedan guardados — la cuenta se mantiene intacta.
            </p>
          </section>
        </>
      )}

      {tab === "meta" && (
        <>
          {!datos ? (
            <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
              Cargando…
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${
                    datos.estado === "conectado"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : datos.estado === "error"
                      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                      : datos.estado === "verificando"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                  }`}
                >
                  {datos.estado === "conectado"
                    ? "✓"
                    : datos.estado === "error"
                    ? "✗"
                    : datos.estado === "verificando"
                    ? "⏳"
                    : "○"}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold tracking-tight">
                    {datos.estado === "conectado"
                      ? "WhatsApp conectado"
                      : datos.estado === "error"
                      ? "Error en la conexión"
                      : datos.estado === "verificando"
                      ? "Verificación pendiente"
                      : "WhatsApp Business no conectado"}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {datos.estado === "conectado"
                      ? `Tu cuenta de WhatsApp Business está activa${
                          datos.verificada_en
                            ? ` desde ${new Date(datos.verificada_en).toLocaleDateString("es-AR")}`
                            : ""
                        }.`
                      : datos.estado === "error"
                      ? datos.ultimo_error ?? "Verificá las credenciales y probá de nuevo."
                      : datos.estado === "verificando"
                      ? 'Cargá las credenciales y tocá "Probar conexión".'
                      : "Cargá las credenciales de tu app de Meta para empezar."}
                  </p>
                </div>
              </div>

              {mensajeMeta && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    mensajeMeta.tipo === "ok"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  }`}
                >
                  {mensajeMeta.texto}
                </div>
              )}

              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    Datos de la cuenta
                  </h3>
                  {!editando && (
                    <button
                      type="button"
                      onClick={() => setEditando(true)}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium hover:border-emerald-500/30 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      ✎ Editar
                    </button>
                  )}
                </div>

                {editando ? (
                  <div className="space-y-3">
                    <Field
                      label="Phone Number ID"
                      value={phoneId}
                      onChange={setPhoneId}
                      placeholder="936..."
                      hint="Lo encontrás en Meta Business Manager → WhatsApp → Configuración"
                    />
                    <Field
                      label="Business Account ID (WABA)"
                      value={businessId}
                      onChange={setBusinessId}
                      placeholder="132..."
                      hint="ID de tu WhatsApp Business Account en Meta"
                    />
                    <Field
                      label="Access Token"
                      value={accessToken}
                      onChange={setAccessToken}
                      placeholder={
                        datos.access_token_configurado
                          ? "Dejá vacío para mantener el actual"
                          : "EAA..."
                      }
                      hint="Token permanente de acceso (Graph API). NO uses tokens temporales en producción."
                      isSecret
                    />
                    <Field
                      label="App Secret (opcional)"
                      value={appSecret}
                      onChange={setAppSecret}
                      placeholder={
                        datos.app_secret_configurado
                          ? "Dejá vacío para mantener el actual"
                          : "..."
                      }
                      hint="Para validar la firma X-Hub-Signature de los webhooks entrantes"
                      isSecret
                    />
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(false);
                          setAccessToken("");
                          setAppSecret("");
                          setPhoneId(datos.phone_number_id ?? "");
                          setBusinessId(datos.business_account_id ?? "");
                        }}
                        className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium dark:border-zinc-800"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={guardar}
                        disabled={guardando}
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {guardando ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <RowDato
                      label="Phone Number ID"
                      valor={datos.phone_number_id}
                      ok={!!datos.phone_number_id}
                    />
                    <RowDato
                      label="Business Account ID"
                      valor={datos.business_account_id}
                      ok={!!datos.business_account_id}
                    />
                    <RowDato
                      label="Access Token"
                      valor={datos.access_token_preview || "—"}
                      ok={datos.access_token_configurado}
                    />
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Webhook (plataforma)
                </h3>
                <div className="space-y-3">
                  <RowDato label="Callback URL" valor={callbackUrl} ok={true} copiable />
                  <RowDato label="Verify Token" valor={datos.verify_token} ok={true} copiable />
                  <RowDato
                    label="App Secret"
                    valor={
                      datos.app_secret_configurado
                        ? "Configurado"
                        : "Gestionado por la plataforma"
                    }
                    ok={datos.app_secret_configurado || true}
                  />
                </div>
                <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-400">
                  Pegá la <strong>Callback URL</strong> y el{" "}
                  <strong>Verify Token</strong> en la sección Webhooks de tu app en
                  Meta Developers, suscribiéndote a los campos{" "}
                  <code className="font-mono">messages</code> y{" "}
                  <code className="font-mono">message_status</code>.
                </p>
              </section>

              <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Verificar conexión
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={probar}
                    disabled={probando || !datos.phone_number_id || !datos.access_token_configurado}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {probando ? "Probando…" : "⚡ Probar conexión"}
                  </button>
                  <button
                    type="button"
                    onClick={suscribir}
                    disabled={suscribiendo || !datos.business_account_id || !datos.access_token_configurado}
                    className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    {suscribiendo ? "Suscribiendo…" : "🔗 Suscribir al webhook"}
                  </button>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Link
                  href={`/app/cuentas/${idCuenta}/conversaciones`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  💬 Ir a Conversaciones
                </Link>
                <button
                  type="button"
                  onClick={probar}
                  disabled={probando}
                  className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold hover:border-emerald-500/30 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  🔄 Reconectar
                </button>
              </div>

              <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <strong>⚠ Estado del feature:</strong> la UI guarda credenciales y
                valida la conexión con Meta. La integración bidireccional (recibir
                mensajes vía webhook → bot IA → enviar respuesta vía Cloud API) se
                conecta cuando tengas los permisos de Meta aprobados. Mientras tanto,
                el bot sigue funcionando con WhatsApp Web (Baileys).
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
