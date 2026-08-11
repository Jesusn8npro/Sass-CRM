"use client";

import { useCallback, useEffect, useState } from "react";
import { PropsSeccionBase, Tarjeta, patchCuenta } from "./compartido";

/**
 * Disparadores de negocio: el dueño conecta SU base/sitio al SaaS para que
 * le llegue un WhatsApp cuando pasa algo (se registró un usuario, alguien
 * inició una compra). Acá ve el token, prende/apaga las alertas y comprueba
 * qué eventos están entrando.
 */

interface EventoFila {
  id: string;
  tipo: string;
  titulo: string | null;
  notificado: boolean;
  motivo: string | null;
  creado_en: string;
}

interface Estado {
  token: string | null;
  activos: boolean;
  telefonoOperador: string | null;
  alertasOperador: boolean;
  eventos: EventoFila[];
}

const TIPOS_SUGERIDOS = [
  ["usuario_registrado", "Se registró un usuario nuevo"],
  ["compra_iniciada", "Empezó una compra y quedó pendiente"],
  ["compra_confirmada", "Se confirmó el pago"],
  ["compra_rechazada", "Le rebotó el pago"],
  ["clase_reservada", "Reservó una clase personalizada"],
];

export function SeccionDisparadores({ cuenta, onActualizada }: PropsSeccionBase) {
  const [datos, setDatos] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarToken, setMostrarToken] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/cuentas/${cuenta.id}/eventos`);
      if (!r.ok) throw new Error("No se pudo cargar");
      setDatos((await r.json()) as Estado);
      setError(null);
    } catch {
      setError("No se pudieron cargar los disparadores.");
    }
  }, [cuenta.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternarActivos(valor: boolean) {
    if (guardando) return;
    setGuardando(true);
    const resultado = await patchCuenta(cuenta.id, {
      eventos_negocio_activos: valor,
    });
    if ("error" in resultado) {
      setError(resultado.error);
    } else {
      onActualizada(resultado);
      setDatos((d) => (d ? { ...d, activos: valor } : d));
      setError(null);
    }
    setGuardando(false);
  }

  async function regenerar() {
    if (guardando) return;
    if (
      !confirm(
        "Se genera un token nuevo y el anterior deja de funcionar. Vas a tener que actualizarlo en los disparadores de tu base. ¿Seguimos?",
      )
    ) {
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch(`/api/cuentas/${cuenta.id}/eventos`, { method: "POST" });
      if (!r.ok) throw new Error();
      const { token } = (await r.json()) as { token: string };
      setDatos((d) => (d ? { ...d, token } : d));
      setMostrarToken(true);
    } catch {
      setError("No se pudo regenerar el token.");
    } finally {
      setGuardando(false);
    }
  }

  async function copiarToken() {
    if (!datos?.token) return;
    try {
      await navigator.clipboard.writeText(datos.token);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el navegador puede bloquear el portapapeles: el token ya está visible */
    }
  }

  const sinDestino =
    datos && (!datos.telefonoOperador || !datos.alertasOperador);

  return (
    <Tarjeta
      titulo="Disparadores de tu negocio"
      descripcion="Recibí un WhatsApp al número del operador cuando pasa algo importante en tu plataforma: un registro nuevo, una compra que quedó a medias, un pago confirmado."
    >
      {error && (
        <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
      )}

      {sinDestino && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {!datos?.telefonoOperador
            ? "Falta el teléfono del operador privado (arriba). Sin eso los eventos llegan pero no se envían."
            : "Las alertas del operador están apagadas. Prendelas arriba o los eventos no se van a enviar."}
        </p>
      )}

      <label className="flex items-center gap-3 py-2">
        <input
          type="checkbox"
          checked={datos?.activos ?? true}
          disabled={guardando || !datos}
          onChange={(e) => void alternarActivos(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
        />
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          Enviar los disparadores al WhatsApp del operador
        </span>
      </label>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Token de conexión
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            {datos?.token
              ? mostrarToken
                ? datos.token
                : `${datos.token.slice(0, 8)}${"•".repeat(24)}`
              : "— sin generar —"}
          </code>
          <button
            type="button"
            onClick={() => setMostrarToken((v) => !v)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {mostrarToken ? "Ocultar" : "Ver"}
          </button>
          <button
            type="button"
            onClick={() => void copiarToken()}
            disabled={!datos?.token}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={() => void regenerar()}
            disabled={guardando}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {datos?.token ? "Regenerar" : "Generar token"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Mandá un POST a{" "}
          <code className="font-mono">/api/eventos/negocio</code> con el header{" "}
          <code className="font-mono">x-evento-token</code> y el cuerpo{" "}
          <code className="font-mono">
            {'{ "tipo": "...", "datos": { ... } }'}
          </code>
          . Los tipos con formato propio: {TIPOS_SUGERIDOS.map(([t]) => t).join(", ")}.
          Cualquier otro tipo también funciona y se muestra genérico.
        </p>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Últimos eventos recibidos
          </p>
          <button
            type="button"
            onClick={() => void cargar()}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Actualizar
          </button>
        </div>
        {!datos ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : datos.eventos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
            Todavía no llegó ningún evento. Instalá los disparadores en tu base y
            probá registrando un usuario.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {datos.eventos.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {ev.tipo}
                </span>
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  {new Date(ev.creado_en).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <span
                    className={
                      ev.notificado
                        ? "rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:text-emerald-400 dark:ring-emerald-900"
                        : "rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:text-amber-400 dark:ring-amber-900"
                    }
                    title={ev.motivo ?? undefined}
                  >
                    {ev.notificado ? "enviado" : (ev.motivo ?? "no enviado")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Tarjeta>
  );
}
