"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

import { Field, RowDato } from "./_componentes/helpers";

export default function PaginaWhatsAppBusiness() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [datos, setDatos] = useState<EstadoWA | null>(null);
  const [editando, setEditando] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [suscribiendo, setSuscribiendo] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function cargar() {
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
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
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
        setMensaje({ tipo: "error", texto: d.error ?? "Error al guardar" });
      } else {
        setMensaje({
          tipo: "ok",
          texto: 'Datos guardados. Tocá "Probar conexión" para verificar.',
        });
        setEditando(false);
        setAccessToken("");
        setAppSecret("");
        await cargar();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/whatsapp-business/probar`,
        { method: "POST" },
      );
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        display_phone_number?: string;
        verified_name?: string;
      };
      if (d.ok) {
        setMensaje({
          tipo: "ok",
          texto: `✓ Conexión exitosa: ${d.verified_name ?? ""} (${d.display_phone_number ?? ""})`,
        });
      } else {
        setMensaje({
          tipo: "error",
          texto: `✗ ${d.error ?? "Error desconocido"}`,
        });
      }
      await cargar();
    } finally {
      setProbando(false);
    }
  }

  async function suscribir() {
    setSuscribiendo(true);
    setMensaje(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/whatsapp-business/suscribir-webhook`,
        { method: "POST" },
      );
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (d.ok) {
        setMensaje({
          tipo: "ok",
          texto:
            "✓ App suscrita al webhook. Configurá el callback URL desde el panel de Meta.",
        });
      } else {
        setMensaje({
          tipo: "error",
          texto: `✗ ${d.error ?? "Error suscribiendo"}`,
        });
      }
    } finally {
      setSuscribiendo(false);
    }
  }

  if (!datos) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando…
      </div>
    );
  }

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/wa-cloud/webhook`
      : "/api/wa-cloud/webhook";

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950">
      {/* Hero verde */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-6 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur">
              💬
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                WhatsApp Business
              </h1>
              <p className="text-sm text-white/80">
                Conexión y configuración con la API oficial de Meta
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
        {/* Estado */}
        <div className="mb-5 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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

        {/* Mensaje de operación */}
        {mensaje && (
          <div
            className={`mb-5 rounded-xl px-4 py-3 text-sm ${
              mensaje.tipo === "ok"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {/* Datos de la cuenta */}
        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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

        {/* Webhook */}
        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            Webhook (plataforma)
          </h3>
          <div className="space-y-3">
            <RowDato
              label="Callback URL"
              valor={callbackUrl}
              ok={true}
              copiable
            />
            <RowDato
              label="Verify Token"
              valor={datos.verify_token}
              ok={true}
              copiable
            />
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

        {/* Verificar conexión */}
        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
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

        {/* Acciones finales */}
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

        <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>⚠ Estado del feature:</strong> la UI guarda credenciales y
          valida la conexión con Meta. La integración bidireccional (recibir
          mensajes vía webhook → bot IA → enviar respuesta vía Cloud API) se
          conecta cuando tengas los permisos de Meta aprobados. Mientras tanto,
          el bot sigue funcionando con WhatsApp Web (Baileys).
        </div>
      </div>
    </div>
  );
}
