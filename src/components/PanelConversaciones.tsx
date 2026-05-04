"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ConversacionConPreview,
  Cuenta,
} from "@/lib/baseDatos";
import { ModalNuevaConversacion } from "./ModalNuevaConversacion";
import { ListaConversaciones } from "./ListaConversaciones";
import { PanelConversacion } from "./PanelConversacion";

interface CuentaConEstado extends Cuenta {
  bot_vivo?: boolean;
  qr_png?: string | null;
}

interface RespuestaCuenta {
  cuenta: CuentaConEstado;
}
interface RespuestaConversaciones {
  conversaciones: ConversacionConPreview[];
}

/**
 * Panel principal de conversaciones para UNA cuenta.
 *
 * Contiene: lista de conversaciones a la izquierda + panel de mensajes
 * a la derecha. El sidebar global vive en el layout, no acá.
 */
export function PanelConversaciones({ idCuenta }: { idCuenta: string }) {
  const searchParams = useSearchParams();
  const [cuenta, setCuenta] = useState<CuentaConEstado | null>(null);
  const [conversaciones, setConversaciones] = useState<
    ConversacionConPreview[]
  >([]);
  const [idConvSeleccionada, setIdConvSeleccionada] = useState<string | null>(
    null,
  );
  const [modalNuevaConv, setModalNuevaConv] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [borrando, setBorrando] = useState(false);
  const [confirmarAbierto, setConfirmarAbierto] = useState(false);
  const refDeepLinkAplicado = useRef(false);

  // Polling de cuenta (estado de conexión, etc) cada 8s
  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const res = await fetch(`/api/cuentas/${idCuenta}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as RespuestaCuenta;
        if (!cancelado) setCuenta(data.cuenta);
      } catch {
        /* ignorar */
      }
    }
    cargar();
    let intervalo: NodeJS.Timeout | null = null;
    const arrancar = () => {
      if (intervalo) clearInterval(intervalo);
      intervalo = setInterval(cargar, 8000);
    };
    const detener = () => {
      if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        cargar();
        arrancar();
      } else detener();
    };
    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelado = true;
      detener();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [idCuenta]);

  // Polling de conversaciones cada 6s, solo si la cuenta está conectada
  useEffect(() => {
    if (cuenta?.estado !== "conectado") return;
    let cancelado = false;
    async function cargar() {
      try {
        const res = await fetch(
          `/api/cuentas/${idCuenta}/conversaciones`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as RespuestaConversaciones;
        if (!cancelado) setConversaciones(data.conversaciones);
      } catch {
        /* ignorar */
      }
    }
    cargar();
    let intervalo: NodeJS.Timeout | null = null;
    const arrancar = () => {
      if (intervalo) clearInterval(intervalo);
      intervalo = setInterval(cargar, 6000);
    };
    const detener = () => {
      if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        cargar();
        arrancar();
      } else detener();
    };
    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelado = true;
      detener();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [idCuenta, cuenta?.estado]);

  // Deep link ?conv=X
  useEffect(() => {
    if (refDeepLinkAplicado.current) return;
    if (conversaciones.length === 0) return;
    const idConvParam = searchParams?.get("conv") ?? "";
    if (idConvParam && conversaciones.some((c) => c.id === idConvParam)) {
      setIdConvSeleccionada(idConvParam);
    }
    refDeepLinkAplicado.current = true;
  }, [conversaciones, searchParams]);

  // Si la cuenta NO está conectada, mostrar pantalla de "Conectá WhatsApp"
  if (cuenta && cuenta.estado !== "conectado") {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 text-5xl">📱</div>
        <h2 className="mb-2 text-xl font-semibold">
          {cuenta.estado === "qr"
            ? "Esperando que escanees el QR"
            : "WhatsApp no está conectado"}
        </h2>
        <p className="mb-6 max-w-md text-sm text-zinc-500">
          {cuenta.estado === "qr"
            ? "Escaneá el código QR con tu teléfono para conectar esta cuenta."
            : "Andá a la sección WhatsApp del menú para conectar tu número."}
        </p>
        <a
          href={`/app/cuentas/${idCuenta}/whatsapp`}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-400"
        >
          Ir a configurar WhatsApp →
        </a>
      </div>
    );
  }

  if (!cuenta) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Cargando…
      </div>
    );
  }

  const convSeleccionada =
    conversaciones.find((c) => c.id === idConvSeleccionada) ?? null;

  return (
    <div className="flex h-full">
      <div
        className={`flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 lg:flex lg:w-[340px] lg:shrink-0 ${
          idConvSeleccionada ? "hidden lg:flex" : "flex w-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {modoSeleccion ? (
            <>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Modo selección
                </p>
                <p className="text-sm font-semibold">
                  {seleccionadas.size} seleccionada
                  {seleccionadas.size === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (seleccionadas.size === conversaciones.length) {
                      setSeleccionadas(new Set());
                    } else {
                      setSeleccionadas(
                        new Set(conversaciones.map((c) => c.id)),
                      );
                    }
                  }}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {seleccionadas.size === conversaciones.length
                    ? "Ninguna"
                    : "Todas"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarAbierto(true)}
                  disabled={seleccionadas.size === 0}
                  className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-400 disabled:opacity-40"
                >
                  Eliminar ({seleccionadas.size})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModoSeleccion(false);
                    setSeleccionadas(new Set());
                  }}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Conversaciones
                </p>
                <p className="text-sm font-semibold">
                  {conversaciones.length} chat
                  {conversaciones.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setModoSeleccion(true)}
                  title="Seleccionar varias para borrar"
                  disabled={conversaciones.length === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setModalNuevaConv(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-400"
                  title="Nueva conversación"
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>
        <ListaConversaciones
          conversaciones={conversaciones}
          idSeleccionada={idConvSeleccionada}
          modoSeleccion={modoSeleccion}
          seleccionadas={seleccionadas}
          onToggleSeleccion={(id) => {
            setSeleccionadas((prev) => {
              const n = new Set(prev);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            });
          }}
          onEliminar={(id) => {
            // Reusamos el modal de confirmación bulk-delete con un solo id.
            setSeleccionadas(new Set([id]));
            setConfirmarAbierto(true);
          }}
          onMarcarLeida={(id) => {
            setConversaciones((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      mensajes_nuevos: 0,
                      ultimo_visto_operador_en: new Date().toISOString(),
                    }
                  : c,
              ),
            );
            void fetch(
              `/api/cuentas/${idCuenta}/conversaciones/${id}/marcar-leida`,
              { method: "POST" },
            ).catch(() => {});
          }}
          onSeleccionar={(id) => {
            setIdConvSeleccionada(id);
            // Optimistic UI: bajamos el badge a 0 inmediatamente.
            setConversaciones((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      mensajes_nuevos: 0,
                      ultimo_visto_operador_en: new Date().toISOString(),
                    }
                  : c,
              ),
            );
            // Persistimos en DB en background — si falla, el próximo
            // polling lo va a corregir solo. Fire-and-forget.
            void fetch(
              `/api/cuentas/${idCuenta}/conversaciones/${id}/marcar-leida`,
              { method: "POST" },
            ).catch(() => {
              /* ignorar */
            });
          }}
        />
      </div>

      <div
        className={`min-w-0 flex-1 overflow-hidden ${
          idConvSeleccionada ? "flex" : "hidden lg:flex"
        }`}
      >
        {convSeleccionada ? (
          <PanelConversacion
            cuenta={cuenta}
            idCuenta={idCuenta}
            idConversacion={convSeleccionada.id}
            onVolver={() => setIdConvSeleccionada(null)}
            onConversacionBorrada={(id) => {
              setConversaciones((prev) => prev.filter((c) => c.id !== id));
              setIdConvSeleccionada(null);
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 text-4xl">💬</div>
            <p className="text-sm font-semibold">
              Seleccioná una conversación
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Elegí un contacto del listado para ver los mensajes.
            </p>
          </div>
        )}
      </div>

      {confirmarAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => !borrando && setConfirmarAbierto(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">
              ¿Eliminar {seleccionadas.size} conversación
              {seleccionadas.size === 1 ? "" : "es"}?
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Esto borra los chats con todos sus mensajes, etiquetas, citas y
              datos asociados. <strong>No se puede deshacer.</strong>
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarAbierto(false)}
                disabled={borrando}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={borrando}
                onClick={async () => {
                  if (borrando) return;
                  setBorrando(true);
                  try {
                    const ids = Array.from(seleccionadas);
                    const r = await fetch(
                      `/api/cuentas/${idCuenta}/conversaciones/bulk-delete`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids }),
                      },
                    );
                    if (r.ok) {
                      setConversaciones((prev) =>
                        prev.filter((c) => !seleccionadas.has(c.id)),
                      );
                      if (
                        idConvSeleccionada &&
                        seleccionadas.has(idConvSeleccionada)
                      ) {
                        setIdConvSeleccionada(null);
                      }
                      setSeleccionadas(new Set());
                      setModoSeleccion(false);
                      setConfirmarAbierto(false);
                    }
                  } finally {
                    setBorrando(false);
                  }
                }}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-rose-400 disabled:opacity-50"
              >
                {borrando ? "Eliminando…" : "Sí, eliminar todo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalNuevaConversacion
        abierto={modalNuevaConv}
        idCuenta={idCuenta}
        onCerrar={() => setModalNuevaConv(false)}
        onCreada={(nueva) => {
          // El modal devuelve Conversacion (no ConversacionConPreview);
          // la enriquecemos con preview vacío + sin etiquetas para
          // matchear el tipo del estado local.
          const enriquecida: ConversacionConPreview = {
            ...nueva,
            vista_previa_ultimo_mensaje: null,
            vista_previa_rol: null,
            mensajes_nuevos: 0,
            etiquetas: [],
          };
          setConversaciones((prev) => [enriquecida, ...prev]);
          setIdConvSeleccionada(nueva.id);
          setModalNuevaConv(false);
        }}
      />
    </div>
  );
}
