"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import "./landing.css";

// ── tipos ──────────────────────────────────────────────────────────────────
type Estado = "idle" | "connecting" | "active" | "ended" | "error";

// Detecta browsers de apps (WhatsApp, Instagram, FB) que bloquean getUserMedia
function esNavegadorApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|Twitter|Line\/|WhatsApp|Snapchat|MicroMessenger/.test(
    navigator.userAgent,
  );
}

function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

// ── Barras de voz reactivas ────────────────────────────────────────────────
const BAR_PHASES = [0, 0.4, 0.8, 0.2, 0.6];

function BarrasVoz({ volumen, activo }: { volumen: number; activo: boolean }) {
  // Si hay datos de volumen real los usamos; si no, la animación CSS toma el control
  const hayVolumen = volumen > 0.05;
  return (
    <div className={`voice-bars${activo ? " animando" : ""}`} aria-hidden="true">
      {BAR_PHASES.map((fase, i) => {
        const amp = hayVolumen ? Math.max(0.15, volumen * (0.7 + fase * 0.5)) : 0;
        const h = hayVolumen ? Math.round(4 + amp * 28) : undefined;
        return (
          <div
            key={i}
            className={`voice-bar${activo && hayVolumen ? " speaking" : ""}`}
            style={h !== undefined ? { height: h } : undefined}
          />
        );
      })}
    </div>
  );
}

// ── Pinwheel SVG ──────────────────────────────────────────────────────────
function Pinwheel({ size = 36, spin = true }: { size?: number; spin?: boolean }) {
  return (
    <svg className="pinwheel-svg" width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="3.5" fill="#ff7e2b" />
      <g className={spin ? "pinwheel-rotor" : ""}>
        <path d="M18 18 C15 12 10 4 15 2 C20 0 22 8 18 18Z" fill="#ff7e2b" opacity="0.9"/>
        <path d="M18 18 C24 15 32 10 34 15 C36 20 28 22 18 18Z" fill="#ffb347" opacity="0.9"/>
        <path d="M18 18 C21 24 26 32 21 34 C16 36 14 28 18 18Z" fill="#ff7e2b" opacity="0.9"/>
        <path d="M18 18 C12 21 4 26 2 21 C0 16 8 14 18 18Z" fill="#ffb347" opacity="0.9"/>
      </g>
    </svg>
  );
}

// ── Iconos ─────────────────────────────────────────────────────────────────
function IcoPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.62 10.79z"/>
    </svg>
  );
}
function IcoHangup() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
    </svg>
  );
}
function IcoMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.95-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.05 7.44-7 7.93V22h-2v-6.07z"/>
    </svg>
  );
}
function IcoMicOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
    </svg>
  );
}
function IcoKeyboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 5H5v-2h2v2zm11 0H8v-2h10v2zm0-5h-2v-2h2v2zm0-3h-2V8h2v2zm-4 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
    </svg>
  );
}

// ── Modal de consentimiento ────────────────────────────────────────────────
// El getUserMedia se llama DENTRO del onClick del botón Aceptar,
// garantizando que esté en el contexto directo del gesto del usuario.
// Esta es la única forma que funciona consistentemente en iOS y Android.
function ModalTerminos({
  onConcedido,
  onDenegado,
  onCancelar,
}: {
  onConcedido: () => void;
  onDenegado: (nombre: string) => void;
  onCancelar: () => void;
}) {
  const [cargando, setCargando] = useState(false);

  const handleAceptar = async () => {
    if (cargando) return;
    // ── Verificar soporte ──────────────────────────────────────────
    if (!navigator.mediaDevices?.getUserMedia) {
      onDenegado("NotSupported");
      return;
    }
    setCargando(true);
    // ── getUserMedia directamente en el click (contexto de gesto) ──
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permiso concedido y cacheado. Cerramos los tracks para liberar el mic
      // antes de que VAPI abra su propio stream (evita conflicto en Android).
      stream.getTracks().forEach((t) => t.stop());
      onConcedido();
    } catch (e: unknown) {
      const nombre = e instanceof Error ? e.name : "Unknown";
      onDenegado(nombre);
    }
  };

  return (
    <div className="voice-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <div className="voice-modal">
        <h3 id="modal-titulo" className="voice-modal-title">Antes de comenzar</h3>
        <div className="voice-modal-body">
          <p>
            Esta llamada de voz será grabada y procesada por nuestra IA para mejorar el servicio.
            Al continuar aceptas nuestras{" "}
            <a href="/privacidad" target="_blank" style={{ color: "var(--cyan)", textDecoration: "underline" }}>
              políticas de privacidad
            </a>
            .
          </p>
          <p style={{ fontSize: 12, marginTop: 8, color: "var(--ink-faint)" }}>
            {cargando ? "Solicitando acceso al micrófono…" : "Se solicitará acceso al micrófono de tu dispositivo."}
          </p>
        </div>
        <div className="voice-modal-actions">
          <button className="voice-modal-cancel" onClick={onCancelar} disabled={cargando}>Cancelar</button>
          <button className="voice-modal-accept" onClick={handleAceptar} disabled={cargando}>
            <IcoPhone /> {cargando ? "Verificando…" : "Aceptar e iniciar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function BotonLlamadaVapi() {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [silenciado, setSilenciado] = useState(false);
  const [duracion, setDuracion] = useState(0);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [volumen, setVolumen] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const vapiRef = useRef<InstanceType<typeof Vapi> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enAppBrowser = useRef(esNavegadorApp());

  const limpiar = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setVolumen(0);
  }, []);

  // Inicia VAPI — el permiso de micrófono ya fue concedido y cacheado
  // por el modal antes de llamar a esta función.
  const ejecutarLlamada = useCallback(async () => {
    // Fallback hardcodeado: estos son valores públicos (no secretos).
    // Evita que el widget falle si las env vars no están en el build.
    const publicKey =
      process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "19eefaea-a077-40ff-8ecc-b23a4a4ab213";
    const assistantId =
      process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "067a2db2-249d-40cb-9d24-c3e919a0fabe";

    setEstado("connecting");
    setDuracion(0);
    setVolumen(0);

    try {
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on("call-start", () => {
        setEstado("active");
        setDuracion(0);
        timerRef.current = setInterval(() => setDuracion((s) => s + 1), 1000);
      });

      vapi.on("call-end", () => { setEstado("ended"); limpiar(); });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vapi as any).on("volume-level", (vol: number) => { setVolumen(vol); });

      vapi.on("error", (e: unknown) => {
        console.error("VAPI error:", e);
        setErrorMsg("Error al conectar con el asistente. Intentá de nuevo.");
        setEstado("error");
        limpiar();
      });

      const call = await vapi.start(assistantId);

      if (call?.id) {
        fetch("/api/landing/llamada", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vapi_call_id: call.id }),
        }).catch(() => { /* no-op */ });
      }
    } catch (e) {
      console.error("Error iniciando llamada:", e);
      setErrorMsg("Error inesperado al iniciar. Intentá de nuevo.");
      setEstado("error");
      limpiar();
    }
  }, [limpiar]);

  // Verifica soporte básico antes de abrir el modal
  const iniciarLlamada = useCallback(() => {
    if (enAppBrowser.current || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(
        enAppBrowser.current
          ? 'Abrí esta página en Safari o Chrome. Tocá ··· → "Abrir en Safari" / "Abrir en Chrome".'
          : "Tu navegador no soporta llamadas de voz. Abrí en Safari (iPhone) o Chrome (Android).",
      );
      setEstado("error");
      return;
    }
    setMostrarTerminos(true);
  }, []);

  const handlePermisoConcedido = useCallback(() => {
    setMostrarTerminos(false);
    ejecutarLlamada();
  }, [ejecutarLlamada]);

  const handlePermisoDenegado = useCallback((nombre: string) => {
    setMostrarTerminos(false);
    const ios = esIOS();
    if (nombre === "NotSupported") {
      setErrorMsg(
        enAppBrowser.current
          ? 'Abrí esta página en Safari o Chrome. Tocá ··· → "Abrir en Safari".'
          : "Tu navegador no soporta llamadas. Abrí en Safari o Chrome.",
      );
    } else if (nombre === "NotAllowedError" || nombre === "PermissionDeniedError") {
      setErrorMsg(
        ios
          ? "Permiso denegado. Para habilitarlo:\n📱 Configuración → Privacidad → Micrófono → Safari ✓"
          : "Permiso denegado. Tocá el ícono 🔒 en la barra de dirección → Micrófono → Permitir.",
      );
    } else if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") {
      setErrorMsg("No se encontró micrófono en tu dispositivo.");
    } else {
      setErrorMsg("No se pudo acceder al micrófono. Revisá los permisos e intentá de nuevo.");
    }
    setEstado("error");
  }, []);

  const colgar = useCallback(async () => {
    limpiar();
    try { await vapiRef.current?.stop(); } catch { /* no-op */ }
    vapiRef.current = null;
    setEstado("ended");
  }, [limpiar]);

  const toggleSilencio = useCallback(() => {
    if (!vapiRef.current) return;
    const next = !silenciado;
    setSilenciado(next);
    vapiRef.current.setMuted(next);
  }, [silenciado]);

  const resetear = useCallback(() => {
    setEstado("idle");
    setErrorMsg("");
  }, []);

  useEffect(() => () => { limpiar(); vapiRef.current?.stop(); }, [limpiar]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const enLlamada = estado === "active" || estado === "connecting";
  const hablando = estado === "active" && !silenciado && volumen > 0.04;

  return (
    <>
      {/* ── Bottom CTA bar: voice + WhatsApp ───────────────── */}
      <div className={`bottom-cta-bar${panelAbierto ? " bar-hidden" : ""}`}>
        <button
          className="bottom-cta-voice"
          onClick={() => setPanelAbierto(true)}
          aria-label="Abrir asistente de voz IA"
        >
          <span className="bottom-cta-label">¿Necesitas ayuda?</span>
          <span className="bottom-cta-pill">
            <span className="voice-pinwheel-mini"><Pinwheel size={20} /></span>
            <span className="bottom-cta-text"><IcoPhone /> Hablemos ahora</span>
          </span>
        </button>
        <span className="bottom-cta-sep" aria-hidden="true" />
        <a
          className="bottom-cta-wa"
          href="https://wa.me/34600000000?text=Hola%20quiero%20probar%20Inyectaia"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chatea por WhatsApp"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345m-5.446 7.443h-.016c-1.77 0-3.524-.48-5.055-1.38l-.36-.214-3.75.975 1.005-3.645-.239-.375a9.869 9.869 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
          </svg>
        </a>
      </div>

      {/* ── Modal de términos ──────────────────────────────── */}
      {mostrarTerminos && (
        <ModalTerminos
          onConcedido={handlePermisoConcedido}
          onDenegado={handlePermisoDenegado}
          onCancelar={() => setMostrarTerminos(false)}
        />
      )}

      {/* ── Voice panel ────────────────────────────────────── */}
      <div className={`voice-panel${panelAbierto ? " open" : ""}`} role="dialog" aria-modal="true">

        {/* Header */}
        <div className="voice-panel-head">
          <div className="voice-panel-head-info">
            <div className="voice-head-avatar"><Pinwheel size={22} spin={enLlamada} /></div>
            <div>
              <div className="voice-head-name">Asistente Ventas IA</div>
              <div className="voice-head-status">
                <span className="voice-head-dot" />
                {enLlamada ? "En llamada" : "En línea"}
              </div>
            </div>
          </div>
          <button
            className="voice-panel-close"
            onClick={() => {
              if (enLlamada) colgar();
              setPanelAbierto(false);
              setTimeout(resetear, 400);
            }}
            aria-label="Cerrar"
          >×</button>
        </div>

        {/* Hero idle / error */}
        {(estado === "idle" || estado === "error") && (
          <div className="voice-hero">
            <div className="voice-pinwheel-large">
              <Pinwheel size={80} />
            </div>
            <div className="voice-hero-text">
              <strong>Habla con nuestro agente IA</strong>
              <span>Llamada de voz en directo desde el navegador.<br />Sin instalar nada · 100% gratis para ti.</span>
            </div>

            {estado === "error" && (
              <div style={{ textAlign: "center", width: "100%" }}>
                <p style={{ color: "#ff3e6c", fontSize: 12, whiteSpace: "pre-line", lineHeight: 1.6, margin: "0 0 12px" }}>
                  {errorMsg}
                </p>
                {enAppBrowser.current && (
                  <a
                    href={typeof window !== "undefined" ? window.location.href : "/"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="voice-call-btn-start"
                    style={{ display: "inline-flex", textDecoration: "none", marginBottom: 8 }}
                  >
                    Abrir en Safari / Chrome
                  </a>
                )}
                <br />
                <button
                  onClick={resetear}
                  style={{ background: "none", color: "var(--ink-faint)", fontSize: 12, textDecoration: "underline", cursor: "pointer", border: "none" }}
                >
                  Intentar de nuevo
                </button>
              </div>
            )}

            {estado === "idle" && (
              <button className="voice-call-btn-start" onClick={iniciarLlamada}>
                <IcoPhone /> Iniciar llamada
              </button>
            )}
          </div>
        )}

        {/* Calling / active */}
        {enLlamada && (
          <div className="voice-calling">
            <div className={`voice-pinwheel-large${estado === "active" ? " pulsing" : ""}`}>
              <Pinwheel size={80} spin />
              {estado === "connecting" && (
                <div className="voice-call-btn-mini"><IcoPhone /></div>
              )}
            </div>

            <div className="voice-call-status">
              {estado === "connecting" ? "Conectando..." : hablando ? "Hablando..." : "Escuchando..."}
            </div>

            {estado === "active" && (
              <>
                <BarrasVoz volumen={volumen} activo={!silenciado} />
                <div className="voice-call-time">{fmt(duracion)}</div>
              </>
            )}

            <div className="voice-call-actions">
              <button className="voice-mute" onClick={toggleSilencio} title={silenciado ? "Activar mic" : "Silenciar"}>
                {silenciado ? <IcoMicOff /> : <IcoMic />}
              </button>
              <button className="voice-hangup" onClick={colgar} title="Colgar">
                <IcoHangup />
              </button>
              <button className="voice-keyboard" title="Teclado">
                <IcoKeyboard />
              </button>
            </div>
          </div>
        )}

        {/* Ended */}
        {estado === "ended" && (
          <div className="voice-input">
            <button className="voice-call-btn-start" onClick={resetear}>
              <IcoPhone /> Llamar de nuevo
            </button>
          </div>
        )}

        <div className="voice-foot">
          <Pinwheel size={12} spin={false} />
          <strong>INYECTAIA</strong> · IA de voz en tiempo real
        </div>
      </div>
    </>
  );
}
