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
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Conversaciones
            </p>
            <p className="text-sm font-semibold">
              {conversaciones.length} chat
              {conversaciones.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalNuevaConv(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-400"
            title="Nueva conversación"
          >
            +
          </button>
        </div>
        <ListaConversaciones
          conversaciones={conversaciones}
          idSeleccionada={idConvSeleccionada}
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
