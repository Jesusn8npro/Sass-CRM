"use client";

import { useState, type ReactNode } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";

type Modo = "suscripcion" | "recarga";

/**
 * Provider de scripts PayPal. Tiene que envolver TODOS los <PayPalCheckout>
 * de la misma página. Si una página tiene mix de modos (suscripción + recarga),
 * envolver cada bloque en su propio provider.
 */
export function PayPalProvider({
  modo,
  children,
}: {
  modo: Modo;
  children: ReactNode;
}) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!clientId) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
        PayPal no está configurado. Falta NEXT_PUBLIC_PAYPAL_CLIENT_ID en .env.local.
      </div>
    );
  }
  const opts =
    modo === "suscripcion"
      ? { clientId, currency: "USD", intent: "subscription" as const, vault: true }
      : { clientId, currency: "USD", intent: "capture" as const };
  return <PayPalScriptProvider options={opts}>{children}</PayPalScriptProvider>;
}

interface Props {
  modo: Modo;
  /** Para suscripcion: "pro" | "business". Para recarga: paquete_id. */
  identificador: string;
  /** Sólo recarga: id de cuenta a la que se acreditan los créditos. */
  cuentaId?: string;
  onExito: (resultado: { mensaje: string; datos: Record<string, unknown> }) => void;
  onError?: (msg: string) => void;
}

/**
 * Smart Buttons embedded de PayPal. Debe estar dentro de un <PayPalProvider>.
 * El popup de PayPal se abre dentro de la app — el usuario nunca abandona.
 */
export function PayPalCheckout({ modo, identificador, cuentaId, onExito, onError }: Props) {
  const [estado, setEstado] = useState<"idle" | "procesando" | "ok" | "error">("idle");

  return (
    <div className="space-y-2">
      <PayPalButtons
        style={{
          layout: "vertical",
          color: "gold",
          shape: "pill",
          label: modo === "suscripcion" ? "subscribe" : "pay",
        }}
        forceReRender={[modo, identificador, cuentaId ?? ""]}
        createSubscription={
          modo === "suscripcion"
            ? async () => {
                const r = await fetch("/api/billing/paypal/crear-suscripcion", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan: identificador }),
                });
                const j = await r.json();
                if (!r.ok) throw new Error(j.error ?? "error_creando_suscripcion");
                return j.subscription_id as string;
              }
            : undefined
        }
        createOrder={
          modo === "recarga"
            ? async () => {
                const r = await fetch("/api/billing/paypal/crear-orden", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ paquete_id: identificador, cuenta_id: cuentaId }),
                });
                const j = await r.json();
                if (!r.ok) throw new Error(j.error ?? "error_creando_orden");
                return j.order_id as string;
              }
            : undefined
        }
        onApprove={async (data) => {
          setEstado("procesando");
          try {
            if (modo === "suscripcion" && data.subscriptionID) {
              const r = await fetch("/api/billing/paypal/activar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subscription_id: data.subscriptionID }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error ?? "error_activando");
              setEstado("ok");
              onExito({ mensaje: `Plan ${j.plan} activado.`, datos: j });
              return;
            }
            if (modo === "recarga" && data.orderID) {
              const r = await fetch("/api/billing/paypal/capturar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_id: data.orderID }),
              });
              const j = await r.json();
              if (!r.ok) throw new Error(j.error ?? "error_capturando");
              setEstado("ok");
              onExito({
                mensaje: `${j.creditos_acreditados} créditos acreditados.`,
                datos: j,
              });
              return;
            }
            throw new Error("respuesta_inesperada_paypal");
          } catch (err) {
            setEstado("error");
            onError?.(err instanceof Error ? err.message : "error_desconocido");
          }
        }}
        onCancel={() => setEstado("idle")}
        onError={(err) => {
          console.error("[paypal-buttons]", err);
          setEstado("error");
          onError?.("PayPal devolvió un error. Intentá de nuevo.");
        }}
      />
      {estado === "procesando" && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
          procesando pago...
        </p>
      )}
      {estado === "ok" && (
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-400">
          ✓ pago aprobado
        </p>
      )}
    </div>
  );
}
