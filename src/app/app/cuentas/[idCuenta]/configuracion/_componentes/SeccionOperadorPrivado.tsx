"use client";

import { useEffect, useState } from "react";
import {
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
} from "./compartido";

/**
 * Configuración del "operador privado": teléfono donde el dueño recibe
 * alertas urgentes (lead caliente, handoff, WhatsApp caído) + un
 * resumen diario a las 9am. Más toggle de emails Resend.
 */
export function SeccionOperadorPrivado({
  cuenta,
  onActualizada,
}: PropsSeccionBase) {
  const [telefono, setTelefono] = useState(
    cuenta.telefono_operador_privado ?? "",
  );
  const [alertas, setAlertas] = useState(cuenta.operador_privado_alertas);
  const [resumen, setResumen] = useState(
    cuenta.operador_privado_resumen_diario,
  );
  const [emails, setEmails] = useState(cuenta.notificaciones_email_activas);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const [testWa, setTestWa] = useState<{
    estado: "idle" | "enviando" | "ok" | "error";
    msg?: string;
  }>({ estado: "idle" });
  const [testEmail, setTestEmail] = useState<{
    estado: "idle" | "enviando" | "ok" | "error";
    msg?: string;
  }>({ estado: "idle" });

  useEffect(() => {
    setTelefono(cuenta.telefono_operador_privado ?? "");
    setAlertas(cuenta.operador_privado_alertas);
    setResumen(cuenta.operador_privado_resumen_diario);
    setEmails(cuenta.notificaciones_email_activas);
    setError(null);
    setExito(false);
    setTestWa({ estado: "idle" });
    setTestEmail({ estado: "idle" });
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      telefono_operador_privado: telefono.trim(),
      operador_privado_alertas: alertas,
      operador_privado_resumen_diario: resumen,
      notificaciones_email_activas: emails,
    });
    setGuardando(false);
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
  }

  async function probarWhatsApp() {
    setTestWa({ estado: "enviando" });
    try {
      const res = await fetch(
        `/api/cuentas/${cuenta.id}/operador-privado/test`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        motivo?: string;
      };
      if (res.ok && data.ok) {
        setTestWa({
          estado: "ok",
          msg: "Mensaje encolado. Llega en pocos segundos.",
        });
      } else {
        setTestWa({
          estado: "error",
          msg: motivoLegible(data.motivo) ?? "No se pudo enviar el test.",
        });
      }
    } catch {
      setTestWa({ estado: "error", msg: "Error de red." });
    }
  }

  async function probarEmail() {
    setTestEmail({ estado: "enviando" });
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}/test-email`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        motivo?: string;
        to?: string;
      };
      if (res.ok && data.ok) {
        setTestEmail({
          estado: "ok",
          msg: `Enviado a ${data.to ?? "tu correo"}.`,
        });
      } else {
        setTestEmail({
          estado: "error",
          msg: motivoLegibleEmail(data.motivo) ?? "No se pudo enviar.",
        });
      }
    } catch {
      setTestEmail({ estado: "error", msg: "Error de red." });
    }
  }

  return (
    <Tarjeta
      titulo="Operador privado"
      descripcion="Recibí alertas urgentes y un resumen diario en TU número de WhatsApp + opt-in de emails."
    >
      <form onSubmit={guardar} className="flex flex-col gap-5">
        <div>
          <Etiqueta>Tu número de WhatsApp (con código país)</Etiqueta>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 314 409 6187"
            inputMode="tel"
            className={`${inputClases()} max-w-[280px]`}
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Se guarda solo dígitos, sin "+". Ej: 573144096187. Si lo dejás
            vacío, no recibís alertas ni resumen aunque los toggles estén
            activados.
          </p>
        </div>

        <Toggle
          checked={alertas}
          onChange={setAlertas}
          titulo="Recibir alertas urgentes"
          descripcion="Lead caliente (score ≥ 80), handoff a humano, y cuenta de WhatsApp desconectada."
        />

        <Toggle
          checked={resumen}
          onChange={setResumen}
          titulo="Resumen diario a las 9am"
          descripcion="Mensajes recibidos ayer, leads nuevos, citas de hoy, top productos y alertas."
        />

        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <Toggle
            checked={emails}
            onChange={setEmails}
            titulo="Recibir emails (Resend)"
            descripcion="Reportes semanales y avisos de WhatsApp caído. Bienvenida y emails de pagos siempre se mandan."
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Test WhatsApp
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Manda un mensaje de prueba a tu número.
          </p>
          <button
            type="button"
            onClick={probarWhatsApp}
            disabled={testWa.estado === "enviando" || !telefono.trim()}
            className="mt-3 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {testWa.estado === "enviando" ? "Enviando…" : "Enviar test ahora"}
          </button>
          {testWa.estado === "ok" && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              {testWa.msg}
            </p>
          )}
          {testWa.estado === "error" && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              {testWa.msg}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Test email
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Manda un email de prueba a tu correo de la cuenta.
          </p>
          <button
            type="button"
            onClick={probarEmail}
            disabled={testEmail.estado === "enviando"}
            className="mt-3 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {testEmail.estado === "enviando" ? "Enviando…" : "Enviar test ahora"}
          </button>
          {testEmail.estado === "ok" && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              {testEmail.msg}
            </p>
          )}
          {testEmail.estado === "error" && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              {testEmail.msg}
            </p>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

function Toggle({
  checked,
  onChange,
  titulo,
  descripcion,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  titulo: string;
  descripcion: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
      />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {titulo}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
          {descripcion}
        </span>
      </span>
    </label>
  );
}

function motivoLegible(m: string | undefined): string | null {
  switch (m) {
    case "sin_telefono":
      return "Falta configurar el número del operador. Guardalo y volvé a intentar.";
    case "sin_contenido":
      return "El mensaje quedó vacío.";
    case "cuenta_desconectada":
      return "Tu WhatsApp está desconectado — reconectá la cuenta primero.";
    case "excepcion":
      return "Error interno encolando el mensaje.";
    default:
      return null;
  }
}

function motivoLegibleEmail(m: string | undefined): string | null {
  switch (m) {
    case "sin_api_key":
      return "Resend no está configurado en el servidor (RESEND_API_KEY).";
    case "error_api":
      return "Resend devolvió error. Revisá el log del servidor.";
    case "sin_email_usuario":
      return "Tu usuario no tiene email asociado.";
    default:
      return null;
  }
}
