"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Conversacion,
  Cuenta,
  Mensaje,
  ModoConversacion,
  RespuestaRapida,
} from "@/lib/baseDatos";
import { BurbujaMensaje } from "./BurbujaMensaje";
import { PanelDetalleCliente } from "./PanelDetalleCliente";
import { ChatFooter } from "./_chatFooter";
import { ChatHeader } from "./_chatHeader";

interface Props {
  idCuenta: string;
  idConversacion: string;
  cuenta: Cuenta;
  onConversacionBorrada: (id: string) => void;
  /** Volver a la lista (mobile only). En desktop el botón se oculta. */
  onVolver?: () => void;
}

interface RespuestaMensajes {
  conversacion: Conversacion;
  mensajes: Mensaje[];
}

export function PanelConversacion({
  idCuenta,
  idConversacion,
  cuenta,
  onConversacionBorrada,
  onVolver,
}: Props) {
  const [conversacion, setConversacion] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [borrador, setBorrador] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [subiendoMedia, setSubiendoMedia] = useState(false);
  const [errorMedia, setErrorMedia] = useState<string | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [emojiAbierto, setEmojiAbierto] = useState(false);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState(false);
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mensajeHistorial, setMensajeHistorial] = useState<string | null>(null);
  const refScroll = useRef<HTMLDivElement>(null);
  const refInputArchivo = useRef<HTMLInputElement>(null);
  const refTextarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelado = false;
    const url = `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`;

    async function cargar() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as RespuestaMensajes;
        if (cancelado) return;
        setConversacion(data.conversacion);
        setMensajes(data.mensajes);
      } catch {
        // ignorar
      }
    }

    cargar();
    // Mensajes de la conv abierta: polling cada 4s (era 2s).
    // Pausa cuando la pestaña no está visible — no tiene sentido
    // refrescar mensajes si el usuario no está mirando.
    let intervalo: NodeJS.Timeout | null = null;
    const arrancar = () => {
      if (intervalo) clearInterval(intervalo);
      intervalo = setInterval(cargar, 4000);
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
      } else {
        detener();
      }
    };
    if (document.visibilityState === "visible") arrancar();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelado = true;
      detener();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [idCuenta, idConversacion]);

  useEffect(() => {
    const el = refScroll.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mensajes.length]);

  useEffect(() => {
    setDetalleAbierto(false);
    setBorrador("");
    setEmojiAbierto(false);
    setRespuestasAbiertas(false);
    setMensajeHistorial(null);
  }, [idConversacion]);

  /**
   * Pide a WhatsApp más mensajes anteriores al más viejo que tenemos
   * de esta conversación. Llegan async vía Baileys; el polling de
   * mensajes los va a mostrar en cuanto se inserten en DB.
   */
  async function cargarHistorialAnterior() {
    if (cargandoHistorial) return;
    setCargandoHistorial(true);
    setMensajeHistorial(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conversaciones/${idConversacion}/cargar-historial`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidad: 50 }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMensajeHistorial(data.error ?? "No se pudo pedir el historial.");
      } else {
        setMensajeHistorial(
          "Pedido enviado a WhatsApp. Los mensajes van a aparecer en unos segundos.",
        );
      }
    } catch (err) {
      setMensajeHistorial(
        err instanceof Error ? err.message : "Error de red pidiendo historial.",
      );
    } finally {
      setCargandoHistorial(false);
    }
  }

  // Cargar respuestas rápidas de la cuenta una vez
  useEffect(() => {
    let cancelado = false;
    fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { respuestas: RespuestaRapida[] } | null) => {
        if (!cancelado && data) setRespuestas(data.respuestas);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [idCuenta]);

  function insertarEnTextarea(texto: string) {
    const el = refTextarea.current;
    if (!el) {
      setBorrador((b) => b + texto);
      return;
    }
    const inicio = el.selectionStart ?? borrador.length;
    const fin = el.selectionEnd ?? borrador.length;
    const nuevo = borrador.slice(0, inicio) + texto + borrador.slice(fin);
    setBorrador(nuevo);
    // Reposicionar cursor al final del texto insertado
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(inicio + texto.length, inicio + texto.length);
    }, 0);
  }

  const subirAudioVoz = useCallback(
    async (blob: Blob) => {
      const archivo = new File(
        [blob],
        `voz_${Date.now()}.${blob.type.includes("ogg") ? "ogg" : "webm"}`,
        { type: blob.type || "audio/webm" },
      );
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("caption", "");
      const res = await fetch(
        `/api/cuentas/${idCuenta}/mensajes/${idConversacion}/multimedia`,
        { method: "POST", body: formData },
      );
      if (res.ok) {
        const recargar = await fetch(
          `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
          { cache: "no-store" },
        );
        if (recargar.ok) {
          const data = (await recargar.json()) as RespuestaMensajes;
          setMensajes(data.mensajes);
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    },
    [idCuenta, idConversacion],
  );

  function actualizarModo(nuevo: ModoConversacion) {
    setConversacion((prev) => (prev ? { ...prev, modo: nuevo } : prev));
  }

  async function enviarMensajeHumano() {
    const texto = borrador.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contenido: texto }),
        },
      );
      if (res.ok) {
        setBorrador("");
        const recargar = await fetch(
          `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
          { cache: "no-store" },
        );
        if (recargar.ok) {
          const data = (await recargar.json()) as RespuestaMensajes;
          setConversacion(data.conversacion);
          setMensajes(data.mensajes);
        }
      }
    } finally {
      setEnviando(false);
    }
  }

  async function subirArchivo(archivo: File) {
    if (subiendoMedia) return;
    setSubiendoMedia(true);
    setErrorMedia(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("caption", borrador.trim());
      const res = await fetch(
        `/api/cuentas/${idCuenta}/mensajes/${idConversacion}/multimedia`,
        { method: "POST", body: formData },
      );
      if (res.ok) {
        setBorrador("");
        const recargar = await fetch(
          `/api/cuentas/${idCuenta}/mensajes/${idConversacion}`,
          { cache: "no-store" },
        );
        if (recargar.ok) {
          const data = (await recargar.json()) as RespuestaMensajes;
          setMensajes(data.mensajes);
        }
      } else {
        // Mostrar error legible al usuario
        if (res.status === 413) {
          setErrorMedia(
            `El archivo es demasiado grande. Máximo 50MB.`,
          );
        } else {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setErrorMedia(data.error ?? `Error subiendo (HTTP ${res.status}).`);
        }
        setTimeout(() => setErrorMedia(null), 5000);
      }
    } catch (err) {
      console.error("[panel] error subiendo:", err);
      setErrorMedia("Error de red al subir el archivo.");
      setTimeout(() => setErrorMedia(null), 5000);
    } finally {
      setSubiendoMedia(false);
      if (refInputArchivo.current) refInputArchivo.current.value = "";
    }
  }

  if (!conversacion) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-2 w-2 animate-pulso-suave rounded-full bg-zinc-400 dark:bg-zinc-600" />
          Cargando conversación...
        </div>
      </div>
    );
  }

  const esIA = conversacion.modo === "IA";
  const dc = conversacion.datos_capturados ?? {};
  const nombreReal = dc.nombre?.trim() || conversacion.nombre || `+${conversacion.telefono}`;
  const inicial = nombreReal[0]?.toUpperCase() ?? "?";
  const score = conversacion.lead_score ?? 0;
  const estadoLead = conversacion.estado_lead ?? "nuevo";
  const paso = conversacion.paso_actual ?? "inicio";

  // "En línea" si hubo un mensaje del cliente en los últimos 5 minutos
  const ultimoMsg = conversacion.ultimo_mensaje_en
    ? new Date(conversacion.ultimo_mensaje_en).getTime()
    : 0;
  const enLinea = Date.now() - ultimoMsg < 5 * 60 * 1000;

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        idCuenta={idCuenta}
        cuenta={cuenta}
        conversacion={conversacion}
        inicial={inicial}
        enLinea={enLinea}
        nombreReal={nombreReal}
        paso={paso}
        estadoLead={estadoLead}
        score={score}
        abrirDetalle={() => setDetalleAbierto(true)}
        actualizarModo={actualizarModo}
        onVolver={onVolver}
      />

      <PanelDetalleCliente
        abierto={detalleAbierto}
        idCuenta={idCuenta}
        conversacion={conversacion}
        onCerrar={() => setDetalleAbierto(false)}
        onActualizada={(c) => setConversacion(c)}
        onConversacionBorrada={onConversacionBorrada}
      />

      <div ref={refScroll} className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
        {mensajes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-600">
              Sin mensajes en esta conversación.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="mx-auto flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={cargarHistorialAnterior}
                disabled={cargandoHistorial}
                className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-emerald-500/30 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
              >
                {cargandoHistorial
                  ? "Pidiendo a WhatsApp…"
                  : "↑ Cargar mensajes anteriores"}
              </button>
              {mensajeHistorial && (
                <p className="text-center text-[11px] text-zinc-500">
                  {mensajeHistorial}
                </p>
              )}
            </div>
            {mensajes.map((m) => (
              <BurbujaMensaje key={m.id} mensaje={m} idCuenta={idCuenta} />
            ))}
          </div>
        )}
      </div>

      <ChatFooter
        esIA={esIA}
        errorMedia={errorMedia}
        borrador={borrador}
        setBorrador={setBorrador}
        emojiAbierto={emojiAbierto}
        setEmojiAbierto={setEmojiAbierto}
        respuestasAbiertas={respuestasAbiertas}
        setRespuestasAbiertas={setRespuestasAbiertas}
        respuestas={respuestas}
        refTextarea={refTextarea}
        refInputArchivo={refInputArchivo}
        enviarMensajeHumano={enviarMensajeHumano}
        insertarEnTextarea={insertarEnTextarea}
        subirArchivo={subirArchivo}
        subirAudioVoz={subirAudioVoz}
        subiendoMedia={subiendoMedia}
        enviando={enviando}
      />
    </div>
  );
}
