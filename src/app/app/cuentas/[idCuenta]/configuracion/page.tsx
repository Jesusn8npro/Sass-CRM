"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  Cuenta,
  EntradaConocimiento,
  EtiquetaConCount,
  MedioBiblioteca,
  RespuestaRapida,
} from "@/lib/baseDatos";
import { InterruptorTema } from "@/components/InterruptorTema";
import { BotonReproducirVoz } from "@/components/BotonReproducirVoz";
import { ClonadorVoz } from "@/components/ClonadorVoz";

interface RespuestaCuenta {
  cuenta: Cuenta;
}
interface RespuestaConocimiento {
  entradas: EntradaConocimiento[];
}
interface RespuestaRespuestas {
  respuestas: RespuestaRapida[];
}
interface RespuestaEtiquetas {
  etiquetas: EtiquetaConCount[];
}
interface RespuestaBiblioteca {
  medios: MedioBiblioteca[];
}

// Voces default de ElevenLabs (funcionan con plan free vía API).
// Las voces de la biblioteca personal devuelven 402 paid_plan_required.
const VOCES_DEFAULT = [
  { nombre: "Sarah (mujer)", id: "EXAVITQu4vr4xnSDxMaL" },
  { nombre: "Aria (mujer)", id: "9BWtsMINqrJLrRacOk9x" },
  { nombre: "Rachel (mujer)", id: "21m00Tcm4TlvDq8ikWAM" },
  { nombre: "Adam (hombre)", id: "pNInz6obpgDQGcFmaJgB" },
  { nombre: "Antoni (hombre)", id: "ErXwobaYiN019PkySvjV" },
];

export default function PaginaConfiguracion() {
  const params = useParams<{ idCuenta: string }>();
  const idCuenta = Number(params?.idCuenta);

  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [conocimiento, setConocimiento] = useState<EntradaConocimiento[]>([]);
  const [respuestas, setRespuestas] = useState<RespuestaRapida[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaConCount[]>([]);
  const [biblioteca, setBiblioteca] = useState<MedioBiblioteca[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recargarCuenta = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}`, { cache: "no-store" });
      if (!res.ok) {
        setError("No se pudo cargar la cuenta");
        return;
      }
      const data = (await res.json()) as RespuestaCuenta;
      setCuenta(data.cuenta);
      setError(null);
    } catch {
      setError("Error de red al cargar la cuenta");
    }
  }, [idCuenta]);

  const recargarConocimiento = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conocimiento`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaConocimiento;
      setConocimiento(data.entradas);
    } catch {
      // ignorar
    }
  }, [idCuenta]);

  const recargarRespuestas = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaRespuestas;
      setRespuestas(data.respuestas);
    } catch {}
  }, [idCuenta]);

  const recargarEtiquetas = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/etiquetas`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaEtiquetas;
      setEtiquetas(data.etiquetas);
    } catch {}
  }, [idCuenta]);

  const recargarBiblioteca = useCallback(async () => {
    if (!Number.isFinite(idCuenta)) return;
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/biblioteca`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as RespuestaBiblioteca;
      setBiblioteca(data.medios);
    } catch {}
  }, [idCuenta]);

  useEffect(() => {
    recargarCuenta();
    recargarConocimiento();
    recargarRespuestas();
    recargarEtiquetas();
    recargarBiblioteca();
  }, [
    recargarCuenta,
    recargarConocimiento,
    recargarRespuestas,
    recargarEtiquetas,
    recargarBiblioteca,
  ]);

  if (!Number.isFinite(idCuenta) || idCuenta <= 0) {
    return <CargandoOError mensaje="ID de cuenta inválido" />;
  }
  if (error && !cuenta) {
    return <CargandoOError mensaje={error} />;
  }
  if (!cuenta) {
    return <CargandoOError mensaje="Cargando..." />;
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/app"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
              aria-label="Volver"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Configuración del agente
              </p>
              <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {cuenta.etiqueta}
              </h1>
            </div>
          </div>
          <InterruptorTema />
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
        <SeccionIdentidad cuenta={cuenta} onActualizada={setCuenta} />
        <SeccionPrompt cuenta={cuenta} onActualizada={setCuenta} />
        <SeccionContexto cuenta={cuenta} onActualizada={setCuenta} />
        <SeccionConocimiento
          idCuenta={cuenta.id}
          entradas={conocimiento}
          onCambio={recargarConocimiento}
        />
        <SeccionComportamiento cuenta={cuenta} onActualizada={setCuenta} />
        <SeccionVoz cuenta={cuenta} onActualizada={setCuenta} />
        <SeccionVapi cuenta={cuenta} onActualizada={setCuenta} />
        <SeccionRespuestasRapidas
          idCuenta={cuenta.id}
          respuestas={respuestas}
          onCambio={recargarRespuestas}
        />
        <SeccionEtiquetas
          idCuenta={cuenta.id}
          etiquetas={etiquetas}
          onCambio={recargarEtiquetas}
        />
        <SeccionBiblioteca
          idCuenta={cuenta.id}
          medios={biblioteca}
          onCambio={recargarBiblioteca}
        />
        <SeccionAvanzado cuenta={cuenta} />
      </div>
    </main>
  );
}

// ============================================================
// Helpers UI
// ============================================================
function CargandoOError({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <span className="h-2 w-2 animate-pulso-suave rounded-full bg-zinc-400 dark:bg-zinc-600" />
        {mensaje}
      </div>
    </main>
  );
}

interface PropsSeccionBase {
  cuenta: Cuenta;
  onActualizada: (cuenta: Cuenta) => void;
}

function Tarjeta({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-5">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {titulo}
        </h2>
        {descripcion && (
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            {descripcion}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </label>
  );
}

function inputClases(): string {
  return "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600";
}

function textareaClases(): string {
  return `${inputClases()} resize-y font-mono text-xs leading-relaxed`;
}

function botonGuardar({
  texto = "Guardar",
  guardando,
  disabled,
}: {
  texto?: string;
  guardando: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={guardando || disabled}
      className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {guardando ? "Guardando..." : texto}
    </button>
  );
}

function MensajeEstado({
  exito,
  error,
}: {
  exito: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
    );
  }
  if (exito) {
    return (
      <p className="text-xs text-emerald-700 dark:text-emerald-300">
        Guardado.
      </p>
    );
  }
  return null;
}

async function patchCuenta(
  idCuenta: number,
  body: Record<string, unknown>,
): Promise<Cuenta | { error: string }> {
  try {
    const res = await fetch(`/api/cuentas/${idCuenta}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as
      | { cuenta: Cuenta }
      | { error: string };
    if (!res.ok) {
      return {
        error:
          (data as { error?: string }).error ?? "Error guardando cambios",
      };
    }
    return (data as { cuenta: Cuenta }).cuenta;
  } catch {
    return { error: "Error de red" };
  }
}

// ============================================================
// Sección: Identidad (etiqueta + modelo)
// ============================================================
function SeccionIdentidad({ cuenta, onActualizada }: PropsSeccionBase) {
  const [etiqueta, setEtiqueta] = useState(cuenta.etiqueta);
  const [modelo, setModelo] = useState(cuenta.modelo ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  // IMPORTANTE: solo re-iniciar el form cuando cambia la cuenta (otro id),
  // NO en cada re-render. El bug anterior reseteaba el form mientras
  // el usuario escribía, cada vez que el polling devolvía nuevos datos.
  useEffect(() => {
    setEtiqueta(cuenta.etiqueta);
    setModelo(cuenta.modelo ?? "");
    setError(null);
    setExito(false);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      etiqueta: etiqueta.trim(),
      modelo: modelo.trim() || null,
    });
    if ("error" in r) {
      setError(r.error);
    } else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Identidad"
      descripcion="Nombre interno de la cuenta y modelo de IA que usa al responder."
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div>
          <Etiqueta>Nombre de la cuenta</Etiqueta>
          <input
            type="text"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            required
            maxLength={60}
            className={inputClases()}
          />
        </div>
        <div>
          <Etiqueta>Modelo de OpenAI</Etiqueta>
          <input
            type="text"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder="gpt-4o-mini"
            className={`${inputClases()} font-mono`}
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Vacío = usar el del .env (OPENAI_MODEL). Otros modelos comunes:{" "}
            <code className="font-mono text-[11px]">gpt-4o</code>,{" "}
            <code className="font-mono text-[11px]">gpt-4-turbo</code>.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando, disabled: !etiqueta.trim() })}
        </div>
      </form>
    </Tarjeta>
  );
}

// ============================================================
// Sección: Prompt del agente
// ============================================================
function SeccionPrompt({ cuenta, onActualizada }: PropsSeccionBase) {
  const [valor, setValor] = useState(cuenta.prompt_sistema);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setValor(cuenta.prompt_sistema);
    setError(null);
    setExito(false);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, { prompt_sistema: valor });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Prompt del agente"
      descripcion="Instrucciones base: personalidad, tono, reglas, qué hacer y qué no. Es lo primero que ve el modelo en cada conversación."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <textarea
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={14}
          placeholder="Eres un asistente virtual amable. Responde en español neutro..."
          className={textareaClases()}
        />
        <p className="text-xs text-zinc-500">
          Cambios aplican al próximo mensaje entrante. No hace falta reiniciar
          el bot.
        </p>
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}

// ============================================================
// Sección: Contexto del negocio (texto largo libre)
// ============================================================
function SeccionContexto({ cuenta, onActualizada }: PropsSeccionBase) {
  const [valor, setValor] = useState(cuenta.contexto_negocio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setValor(cuenta.contexto_negocio);
    setError(null);
    setExito(false);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, { contexto_negocio: valor });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Información del negocio"
      descripcion="Texto libre con todo lo que el agente debe saber sobre tu negocio: qué vendés, dónde, horarios, políticas. Se inyecta como contexto en cada respuesta."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <textarea
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={10}
          placeholder={`Vendemos acordeones nuevos y usados.
Estamos en Bogotá, Colombia. Enviamos a todo el país.
Aceptamos pago contra entrega, transferencia y tarjeta.
Garantía de 1 año contra defectos de fábrica.
Horario: L-V 9am a 6pm, S 10am a 2pm.`}
          className={textareaClases()}
        />
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}

// ============================================================
// Sección: Conocimiento estructurado (entradas individuales)
// ============================================================
interface PropsSeccionConocimiento {
  idCuenta: number;
  entradas: EntradaConocimiento[];
  onCambio: () => void;
}

function SeccionConocimiento({
  idCuenta,
  entradas,
  onCambio,
}: PropsSeccionConocimiento) {
  const [creando, setCreando] = useState(false);
  const [tituloNuevo, setTituloNuevo] = useState("");
  const [contenidoNuevo, setContenidoNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!tituloNuevo.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/conocimiento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: tituloNuevo.trim(),
          contenido: contenidoNuevo,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Error creando entrada");
        return;
      }
      setTituloNuevo("");
      setContenidoNuevo("");
      onCambio();
    } finally {
      setCreando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Conocimiento estructurado"
      descripcion="Bloques separados de información que el agente puede consultar: productos, precios, FAQs, etc. Cada uno con su título y contenido."
    >
      {entradas.length > 0 && (
        <ul className="mb-5 flex flex-col gap-3">
          {entradas.map((entrada) => (
            <EntradaConocimientoItem
              key={entrada.id}
              idCuenta={idCuenta}
              entrada={entrada}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={agregar}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Nueva entrada
        </p>
        <input
          type="text"
          value={tituloNuevo}
          onChange={(e) => setTituloNuevo(e.target.value)}
          placeholder="Ej: Productos disponibles, Precios, Horarios..."
          maxLength={80}
          className={`${inputClases()} mb-3`}
        />
        <textarea
          value={contenidoNuevo}
          onChange={(e) => setContenidoNuevo(e.target.value)}
          rows={5}
          placeholder="Escribe el contenido de esta entrada..."
          className={`${textareaClases()} mb-3`}
        />
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creando || !tituloNuevo.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creando ? "Agregando..." : "+ Agregar entrada"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function EntradaConocimientoItem({
  idCuenta,
  entrada,
  onCambio,
}: {
  idCuenta: number;
  entrada: EntradaConocimiento;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(entrada.titulo);
  const [contenido, setContenido] = useState(entrada.contenido);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    setTitulo(entrada.titulo);
    setContenido(entrada.contenido);
  }, [entrada.id, entrada.actualizada_en]);

  async function guardar() {
    if (guardando || !titulo.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conocimiento/${entrada.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titulo: titulo.trim(), contenido }),
        },
      );
      if (res.ok) {
        setEditando(false);
        onCambio();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/conocimiento/${entrada.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onCambio();
      }
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  }

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      {editando ? (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={80}
            className={inputClases()}
          />
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            rows={6}
            className={textareaClases()}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setTitulo(entrada.titulo);
                setContenido(entrada.contenido);
              }}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !titulo.trim()}
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {entrada.titulo}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-full px-3 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                Editar
              </button>
              {confirmandoBorrado ? (
                <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => setConfirmandoBorrado(false)}
                    className="rounded-full px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={borrar}
                    disabled={borrando}
                    className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-500/30 dark:text-red-300"
                  >
                    {borrando ? "..." : "Sí, borrar"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrado(true)}
                  className="rounded-full px-3 py-1 text-xs text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>
          {entrada.contenido && (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {entrada.contenido}
            </p>
          )}
        </>
      )}
    </li>
  );
}

// ============================================================
// Sección: Comportamiento (buffer de mensajes)
// ============================================================
function SeccionComportamiento({ cuenta, onActualizada }: PropsSeccionBase) {
  const [bufferSegundos, setBufferSegundos] = useState(cuenta.buffer_segundos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setBufferSegundos(cuenta.buffer_segundos);
    setError(null);
    setExito(false);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      buffer_segundos: bufferSegundos,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Comportamiento"
      descripcion="Cómo agrupa el bot los mensajes antes de responder."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <Etiqueta>Buffer de mensajes (segundos)</Etiqueta>
          <input
            type="number"
            min={0}
            max={120}
            value={bufferSegundos}
            onChange={(e) =>
              setBufferSegundos(Math.max(0, Number(e.target.value) || 0))
            }
            className={`${inputClases()} max-w-[140px]`}
          />
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            <strong className="text-zinc-700 dark:text-zinc-300">0</strong> =
            responder de inmediato a cada mensaje (default).
            <br />
            <strong className="text-zinc-700 dark:text-zinc-300">5-15s</strong> ={" "}
            esperar ese tiempo después del último mensaje del usuario antes de
            responder. Si llegan más mensajes en ese lapso, el contador se
            reinicia. Hace que el bot responda al "bloque completo" en vez de
            fragmentado, mucho más natural.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}

// ============================================================
// Sección: Voz (ElevenLabs)
// ============================================================
function SeccionVoz({ cuenta, onActualizada }: PropsSeccionBase) {
  const [voz, setVoz] = useState(cuenta.voz_elevenlabs ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [vocesPersonales, setVocesPersonales] = useState<
    Array<{ voice_id: string; name: string; category: string }>
  >([]);
  const [cargandoVoces, setCargandoVoces] = useState(false);
  const [errorVoces, setErrorVoces] = useState<string | null>(null);

  const cargarVoces = useCallback(async () => {
    setCargandoVoces(true);
    setErrorVoces(null);
    try {
      const res = await fetch("/api/elevenlabs/voces", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as
        | {
            voces: Array<{
              voice_id: string;
              name: string;
              category: string;
            }>;
          }
        | { error: string };
      if (res.ok && "voces" in data) {
        // Mostramos todas las voces que NO son premade default. Eso
        // incluye: cloned (IVC), professional (PVC), generated (Voice
        // Designer) y famous. Así aparecen también las que agregaste
        // desde la Voice Library de ElevenLabs.
        const personales = data.voces.filter((v) => v.category !== "premade");
        setVocesPersonales(personales);
      } else {
        setErrorVoces(
          ("error" in data && data.error) ||
            `No se pudieron listar voces (HTTP ${res.status})`,
        );
      }
    } catch (err) {
      setErrorVoces(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCargandoVoces(false);
    }
  }, []);

  useEffect(() => {
    setVoz(cuenta.voz_elevenlabs ?? "");
    setError(null);
    setExito(false);
    cargarVoces();
  }, [cuenta.id, cargarVoces]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const limpio = voz.trim();
    const r = await patchCuenta(cuenta.id, {
      voz_elevenlabs: limpio.length > 0 ? limpio : null,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  const activado = !!cuenta.voz_elevenlabs?.trim();

  return (
    <Tarjeta
      titulo="Voz (ElevenLabs)"
      descripcion="Modo espejo: el agente responde en nota de voz SOLO cuando el cliente le envía un audio. Si el cliente escribe, el agente responde con texto multi-parte (no quema créditos de voz innecesario). Necesita ELEVENLABS_API_KEY en .env.local."
    >
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <div>
          <Etiqueta>Voice ID de ElevenLabs</Etiqueta>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={voz}
              onChange={(e) => setVoz(e.target.value)}
              placeholder="Ej: 21m00Tcm4TlvDq8ikWAM (o vacío para texto)"
              className={`${inputClases()} font-mono text-xs flex-1`}
            />
            <BotonReproducirVoz vozId={voz} variante="icon" />
          </div>

          {/* Voces personales: cloned, professional, generated, famous.
              Cualquier cosa que no sea premade default. */}
          {vocesPersonales.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Tus voces ({vocesPersonales.length})
                </p>
                <button
                  type="button"
                  onClick={cargarVoces}
                  disabled={cargandoVoces}
                  title="Recargar lista"
                  className="text-[11px] text-emerald-700 underline disabled:opacity-50 dark:text-emerald-400"
                >
                  {cargandoVoces ? "..." : "Recargar"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vocesPersonales.map((v) => {
                  const seleccionada = voz.trim() === v.voice_id;
                  const etiquetaCat =
                    v.category === "cloned"
                      ? "clonada"
                      : v.category === "professional"
                      ? "PVC"
                      : v.category === "generated"
                      ? "diseñada"
                      : v.category === "famous"
                      ? "famosa"
                      : v.category;
                  return (
                    <div
                      key={v.voice_id}
                      className={`flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 transition-colors ${
                        seleccionada
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                          : "border-emerald-500/40 bg-white text-emerald-800 hover:bg-emerald-500/5 dark:border-emerald-500/40 dark:bg-zinc-900 dark:text-emerald-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setVoz(v.voice_id)}
                        className="flex items-baseline gap-1.5 text-[11px]"
                      >
                        <span>{v.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-emerald-700/60 dark:text-emerald-400/60">
                          {etiquetaCat}
                        </span>
                      </button>
                      <BotonReproducirVoz vozId={v.voice_id} variante="pill" />
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">
                💡 El preview ▶ a veces suena en inglés (es un MP3 fijo de
                ElevenLabs). Cuando el bot responde a un cliente, le pasa
                texto en español al modelo y usa esta voz — sí responderá
                en español con su acento.
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Voces default (gratis con plan free)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {VOCES_DEFAULT.map((v) => {
                const seleccionada = voz.trim() === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 transition-colors ${
                      seleccionada
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setVoz(v.id)}
                      className="font-mono text-[11px]"
                    >
                      {v.nombre}
                    </button>
                    <BotonReproducirVoz vozId={v.id} variante="pill" />
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
              Tip: tocá ▶ al lado de cada nombre para escuchar la voz antes
              de elegirla. Las voces de tu <em>biblioteca personal</em>{" "}
              requieren plan pago.
            </p>
          </div>

          {errorVoces && (
            <p className="mt-2 text-[11px] text-red-700 dark:text-red-300">
              No se pudieron listar tus voces clonadas: {errorVoces}
            </p>
          )}

          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Cómo obtener otras voces:{" "}
            <a
              href="https://elevenlabs.io/app/voice-library"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              elevenlabs.io/app/voice-library
            </a>{" "}
            → elegí una voz → copiá el "Voice ID".
            <br />
            <strong className="text-zinc-700 dark:text-zinc-300">Vacío</strong>{" "}
            = nunca usa voz, siempre responde con texto.
            <br />
            <strong className="text-zinc-700 dark:text-zinc-300">Lleno</strong>{" "}
            = modo espejo activo. Si el cliente envía audio, el agente
            responde con audio (esa voz). Si el cliente escribe texto, el
            agente responde con texto.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">
            Estado:{" "}
            {activado ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                Espejo activo
              </span>
            ) : (
              <span className="font-semibold">Solo texto</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <MensajeEstado exito={exito} error={error} />
            {botonGuardar({ guardando })}
          </div>
        </div>

        <ClonadorVoz
          idCuenta={cuenta.id}
          onClonada={(c) => {
            onActualizada(c);
            // Refresca la lista para que aparezca como pill al toque
            cargarVoces();
          }}
        />
      </form>
    </Tarjeta>
  );
}

// ============================================================
// Sección: Vapi (llamadas)
// ============================================================
function SeccionVapi({ cuenta, onActualizada }: PropsSeccionBase) {
  const [apiKey, setApiKey] = useState(cuenta.vapi_api_key ?? "");
  const [phoneId, setPhoneId] = useState(cuenta.vapi_phone_id ?? "");
  const [promptExtra, setPromptExtra] = useState(
    cuenta.vapi_prompt_extra ?? "",
  );
  const [primerMensaje, setPrimerMensaje] = useState(
    cuenta.vapi_primer_mensaje ?? "",
  );
  const [maxSegundos, setMaxSegundos] = useState<number>(
    cuenta.vapi_max_segundos ?? 600,
  );
  const [grabar, setGrabar] = useState<boolean>(cuenta.vapi_grabar !== 0);
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const [phones, setPhones] = useState<
    Array<{ id: string; number?: string; name?: string }>
  >([]);
  const [cargandoPhones, setCargandoPhones] = useState(false);
  const [errorPhones, setErrorPhones] = useState<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<string | null>(null);

  const [telTest, setTelTest] = useState("");
  const [llamandoTest, setLlamandoTest] = useState(false);
  const [resultadoTest, setResultadoTest] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(cuenta.vapi_api_key ?? "");
    setPhoneId(cuenta.vapi_phone_id ?? "");
    setPromptExtra(cuenta.vapi_prompt_extra ?? "");
    setPrimerMensaje(cuenta.vapi_primer_mensaje ?? "");
    setMaxSegundos(cuenta.vapi_max_segundos ?? 600);
    setGrabar(cuenta.vapi_grabar !== 0);
    setError(null);
    setExito(false);
    setResultadoSync(null);
    setResultadoTest(null);
    setPhones([]);
  }, [cuenta.id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      vapi_api_key: apiKey.trim() || null,
      vapi_phone_id: phoneId.trim() || null,
      vapi_prompt_extra: promptExtra.trim() || null,
      vapi_primer_mensaje: primerMensaje.trim() || null,
      vapi_max_segundos: maxSegundos,
      vapi_grabar: grabar ? 1 : 0,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  async function llamadaPrueba() {
    if (llamandoTest) return;
    const tel = telTest.replace(/[^\d]/g, "");
    if (tel.length < 8 || tel.length > 15) {
      setResultadoTest(
        "✗ Número inválido — incluí código de país (ej: 5491123456789)",
      );
      return;
    }
    setLlamandoTest(true);
    setResultadoTest(null);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}/vapi/test-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: tel }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { llamada: { vapi_call_id: string } }
        | { error: string };
      if (res.ok && "llamada" in data) {
        setResultadoTest(
          `✓ Llamada disparada (id ${data.llamada.vapi_call_id.slice(0, 10)}…). Tu teléfono debería sonar en segundos.`,
        );
      } else {
        setResultadoTest(
          "✗ " + (("error" in data && data.error) || `HTTP ${res.status}`),
        );
      }
    } catch (err) {
      setResultadoTest(
        "✗ " + (err instanceof Error ? err.message : "Error de red"),
      );
    } finally {
      setLlamandoTest(false);
    }
  }

  async function cargarPhones() {
    if (cargandoPhones) return;
    setCargandoPhones(true);
    setErrorPhones(null);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}/vapi/phones`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as
        | { phones: typeof phones }
        | { error: string };
      if (res.ok && "phones" in data) {
        setPhones(data.phones);
      } else {
        setErrorPhones(
          ("error" in data && data.error) || `Error HTTP ${res.status}`,
        );
      }
    } catch (err) {
      setErrorPhones(err instanceof Error ? err.message : "Error de red");
    } finally {
      setCargandoPhones(false);
    }
  }

  async function sincronizar() {
    if (sincronizando) return;
    setSincronizando(true);
    setResultadoSync(null);
    try {
      const res = await fetch(
        `/api/cuentas/${cuenta.id}/vapi/sincronizar`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as
        | {
            ok: true;
            creado: boolean;
            assistant_id: string;
            webhook_url: string;
          }
        | { error: string };
      if (res.ok && "ok" in data) {
        setResultadoSync(
          `${data.creado ? "✓ Assistant creado" : "✓ Assistant actualizado"} (id: ${data.assistant_id.slice(0, 12)}...). Webhook: ${data.webhook_url}`,
        );
        // Recargar cuenta para que aparezca el assistant_id
        const c = await fetch(`/api/cuentas/${cuenta.id}`, {
          cache: "no-store",
        });
        if (c.ok) {
          const d = (await c.json()) as { cuenta: typeof cuenta };
          onActualizada(d.cuenta);
        }
      } else {
        setResultadoSync(
          "✗ " + (("error" in data && data.error) || `HTTP ${res.status}`),
        );
      }
    } finally {
      setSincronizando(false);
    }
  }

  const tieneApiKey = !!cuenta.vapi_api_key?.trim();
  const tieneAssistant = !!cuenta.vapi_assistant_id?.trim();
  const tienePhone = !!cuenta.vapi_phone_id?.trim();
  const tieneVoz = !!cuenta.voz_elevenlabs?.trim();
  const todoListo = tieneApiKey && tieneAssistant && tienePhone && tieneVoz;

  return (
    <Tarjeta
      titulo="Llamadas (Vapi)"
      descripcion="Llamadas de voz salientes con tu agente. Vapi orquesta Twilio + LLM + ElevenLabs. Cada cuenta usa su propia API key, su Phone Number ID y su Assistant — todo por negocio. Necesita además tener Voice ID configurado en la sección Voz arriba."
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div>
          <Etiqueta>Vapi API Key</Etiqueta>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="vapi_..."
            className={`${inputClases()} font-mono text-xs`}
          />
          <p className="mt-1.5 text-[11px] text-zinc-500">
            La obtenés en{" "}
            <a
              href="https://dashboard.vapi.ai/account"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              dashboard.vapi.ai/account
            </a>
            . Solo se guarda en tu base de datos local.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Etiqueta>Phone Number ID</Etiqueta>
            <button
              type="button"
              onClick={cargarPhones}
              disabled={!apiKey.trim() || cargandoPhones}
              className="text-[11px] text-emerald-700 underline disabled:opacity-50 dark:text-emerald-400"
            >
              {cargandoPhones ? "Cargando..." : "Buscar mis números"}
            </button>
          </div>
          <input
            type="text"
            value={phoneId}
            onChange={(e) => setPhoneId(e.target.value)}
            placeholder="phone_xxxxxxxx-xxxx-..."
            className={`${inputClases()} font-mono text-xs`}
          />
          {phones.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {phones.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPhoneId(p.id)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    phoneId === p.id
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {p.name || p.number || p.id.slice(0, 8)}
                </button>
              ))}
            </div>
          )}
          {errorPhones && (
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
              {errorPhones}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-zinc-500">
            En{" "}
            <a
              href="https://dashboard.vapi.ai/phone-numbers"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              dashboard.vapi.ai/phone-numbers
            </a>{" "}
            podés comprar un número o importar uno de Twilio.
          </p>
        </div>

        {/* Avanzado: prompt extra, primer mensaje, duración, grabación */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setAvanzadoAbierto((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            <span>Configuración avanzada de la llamada</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 transition-transform ${avanzadoAbierto ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {avanzadoAbierto && (
            <div className="flex flex-col gap-3 border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
              <div>
                <Etiqueta>
                  Instrucciones extra para llamadas (opcional)
                </Etiqueta>
                <textarea
                  value={promptExtra}
                  onChange={(e) => setPromptExtra(e.target.value)}
                  rows={5}
                  placeholder="Ej: Cuando hables por teléfono, hablá más despacio. Si el cliente pregunta por precios, mencioná que el plan estándar arranca en cien mil pesos. Cerrá agendando una demo el viernes."
                  className={`${inputClases()} text-xs leading-relaxed`}
                />
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                  Esto se appendea al prompt principal SOLO para llamadas.
                  Útil para tono distinto, datos que solo decís hablando, o
                  cierre específico telefónico. Vacío = solo se usa el prompt
                  principal.
                </p>
              </div>

              <div>
                <Etiqueta>Primer mensaje de la llamada (opcional)</Etiqueta>
                <input
                  type="text"
                  value={primerMensaje}
                  onChange={(e) => setPrimerMensaje(e.target.value)}
                  placeholder={`Hola, te llamo de ${cuenta.etiqueta}. ¿Tenés un momento?`}
                  className={`${inputClases()} text-xs`}
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  Lo que dice el agente al contestar. Si está vacío, se usa
                  un saludo default con el nombre de la cuenta.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Etiqueta>Duración máxima (segundos)</Etiqueta>
                  <input
                    type="number"
                    value={maxSegundos}
                    onChange={(e) =>
                      setMaxSegundos(
                        Math.max(
                          30,
                          Math.min(3600, Number(e.target.value) || 600),
                        ),
                      )
                    }
                    min={30}
                    max={3600}
                    className={`${inputClases()} text-xs`}
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    30-3600s. Default 600 (10 min).
                  </p>
                </div>
                <div>
                  <Etiqueta>Grabar llamadas</Etiqueta>
                  <label className="mt-1 flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 dark:border-zinc-800">
                    <input
                      type="checkbox"
                      checked={grabar}
                      onChange={(e) => setGrabar(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      {grabar ? "Sí" : "No"} (afecta privacidad)
                    </span>
                  </label>
                </div>
              </div>

              <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-400">
                ⚠ Tras cambiar estos campos, hacé click en{" "}
                <strong>Resincronizar assistant</strong> abajo para que Vapi
                tome los nuevos valores.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Estado
          </p>
          <ul className="flex flex-col gap-1 text-[12px] text-zinc-700 dark:text-zinc-300">
            <ItemEstado activo={tieneApiKey} texto="API key configurada" />
            <ItemEstado activo={tienePhone} texto="Phone Number ID configurado" />
            <ItemEstado
              activo={tieneVoz}
              texto="Voice ID de ElevenLabs (sección Voz)"
            />
            <ItemEstado
              activo={tieneAssistant}
              texto={
                cuenta.vapi_sincronizado_en
                  ? `Assistant sincronizado (${new Date(cuenta.vapi_sincronizado_en * 1000).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })})`
                  : "Assistant sincronizado con Vapi"
              }
            />
          </ul>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={sincronizar}
              disabled={sincronizando || !tieneApiKey || !tieneVoz}
              className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {sincronizando
                ? "Sincronizando..."
                : tieneAssistant
                ? "Resincronizar assistant"
                : "Crear assistant en Vapi"}
            </button>
            {cuenta.vapi_assistant_id && (
              <a
                href={`https://dashboard.vapi.ai/assistants/${cuenta.vapi_assistant_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
              >
                Ver en Vapi ↗
              </a>
            )}
            {todoListo && (
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                ✓ Todo listo para llamar
              </span>
            )}
          </div>
          {resultadoSync && (
            <p
              className={`text-[11px] ${
                resultadoSync.startsWith("✓")
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {resultadoSync}
            </p>
          )}
        </div>

        {/* Llamada de prueba */}
        {todoListo && (
          <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Prueba la llamada
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="tel"
                inputMode="numeric"
                value={telTest}
                onChange={(e) => setTelTest(e.target.value)}
                placeholder="Tu número con código país (ej: 5491123456789)"
                className={`${inputClases()} flex-1 font-mono text-xs`}
              />
              <button
                type="button"
                onClick={llamadaPrueba}
                disabled={llamandoTest || !telTest.trim()}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {llamandoTest ? "Llamando..." : "Llamar a este número"}
              </button>
            </div>
            {resultadoTest && (
              <p
                className={`mt-2 text-[11px] ${
                  resultadoTest.startsWith("✓")
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {resultadoTest}
              </p>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
              Tu teléfono va a sonar y el agente Vapi va a hablar con la
              voz, prompt y configuración que tenés. Cooldown de 1h por
              número entre llamadas.
            </p>
          </div>
        )}

        {!process.env.NEXT_PUBLIC_VAPI_PUBLIC_URL && (
          <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            ⚠ Para que Vapi pueda mandar webhooks (transcripción + grabación)
            necesita una URL pública. En dev usá <code>ngrok</code> /{" "}
            <code>cloudflared</code> y poné <code>VAPI_PUBLIC_URL</code> en{" "}
            <code>.env.local</code>. En producción EasyPanel ya es público.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando })}
        </div>
      </form>
    </Tarjeta>
  );
}

function ItemEstado({ activo, texto }: { activo: boolean; texto: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${
          activo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      />
      <span className={activo ? "" : "text-zinc-500"}>{texto}</span>
    </li>
  );
}

// ============================================================
// Sección: Respuestas rápidas
// ============================================================
function SeccionRespuestasRapidas({
  idCuenta,
  respuestas,
  onCambio,
}: {
  idCuenta: number;
  respuestas: RespuestaRapida[];
  onCambio: () => void;
}) {
  const [creando, setCreando] = useState(false);
  const [atajo, setAtajo] = useState("");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!atajo.trim() || !texto.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/respuestas-rapidas`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atajo: atajo.trim(), texto }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Error creando respuesta");
        return;
      }
      setAtajo("");
      setTexto("");
      onCambio();
    } finally {
      setCreando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Respuestas rápidas"
      descripcion="Plantillas de texto pre-guardadas que podés insertar con un click desde el chat. Ej: saludo, despedida, métodos de pago."
    >
      {respuestas.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {respuestas.map((r) => (
            <RespuestaRapidaItem
              key={r.id}
              idCuenta={idCuenta}
              respuesta={r}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}
      <form
        onSubmit={agregar}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Nueva respuesta
        </p>
        <div className="mb-3">
          <Etiqueta>Atajo (corto, identificador)</Etiqueta>
          <input
            type="text"
            value={atajo}
            onChange={(e) => setAtajo(e.target.value)}
            placeholder="saludo / pago / despedida..."
            maxLength={30}
            className={inputClases()}
          />
        </div>
        <div className="mb-3">
          <Etiqueta>Texto de la respuesta</Etiqueta>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="¡Hola! Gracias por escribirnos..."
            className={textareaClases()}
          />
        </div>
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creando || !atajo.trim() || !texto.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creando ? "Agregando..." : "+ Agregar"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function RespuestaRapidaItem({
  idCuenta,
  respuesta,
  onCambio,
}: {
  idCuenta: number;
  respuesta: RespuestaRapida;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [atajo, setAtajo] = useState(respuesta.atajo);
  const [texto, setTexto] = useState(respuesta.texto);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    setAtajo(respuesta.atajo);
    setTexto(respuesta.texto);
  }, [respuesta.id, respuesta.actualizada_en]);

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/respuestas-rapidas/${respuesta.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atajo: atajo.trim(), texto }),
        },
      );
      if (res.ok) {
        setEditando(false);
        onCambio();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/respuestas-rapidas/${respuesta.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onCambio();
    } finally {
      setBorrando(false);
      setConfirmandoBorrado(false);
    }
  }

  if (editando) {
    return (
      <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <input
          type="text"
          value={atajo}
          onChange={(e) => setAtajo(e.target.value)}
          maxLength={30}
          className={`${inputClases()} mb-2`}
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          className={`${textareaClases()} mb-2`}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setAtajo(respuesta.atajo);
              setTexto(respuesta.texto);
            }}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !atajo.trim() || !texto.trim()}
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {guardando ? "..." : "Guardar"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {respuesta.atajo}
      </span>
      <p className="flex-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {respuesta.texto}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Editar
        </button>
        {confirmandoBorrado ? (
          <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
              className="rounded-full px-2 py-0.5 text-[10px] text-zinc-600"
            >
              No
            </button>
            <button
              type="button"
              onClick={borrar}
              disabled={borrando}
              className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300"
            >
              {borrando ? "..." : "Sí"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
          >
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}

// ============================================================
// Sección: Etiquetas (CRM)
// ============================================================
const COLORES_DISPONIBLES = [
  { id: "zinc", clase: "bg-zinc-500" },
  { id: "rojo", clase: "bg-red-500" },
  { id: "ambar", clase: "bg-amber-500" },
  { id: "amarillo", clase: "bg-yellow-500" },
  { id: "esmeralda", clase: "bg-emerald-500" },
  { id: "azul", clase: "bg-blue-500" },
  { id: "violeta", clase: "bg-violet-500" },
  { id: "rosa", clase: "bg-pink-500" },
] as const;

function clasesPillEtiqueta(color: string): string {
  switch (color) {
    case "rojo":
      return "bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30";
    case "ambar":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30";
    case "amarillo":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 ring-yellow-500/30";
    case "esmeralda":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30";
    case "azul":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/30";
    case "violeta":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30";
    case "rosa":
      return "bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 ring-zinc-500/30";
  }
}

function SeccionEtiquetas({
  idCuenta,
  etiquetas,
  onCambio,
}: {
  idCuenta: number;
  etiquetas: EtiquetaConCount[];
  onCambio: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("esmeralda");
  const [descripcion, setDescripcion] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || creando) return;
    setCreando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/etiquetas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          color,
          descripcion: descripcion.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Error creando etiqueta");
        return;
      }
      setNombre("");
      setDescripcion("");
      onCambio();
    } finally {
      setCreando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Etiquetas (CRM)"
      descripcion="Marcá conversaciones con etiquetas para organizar tu pipeline: caliente, comprado, seguimiento, etc. Después podés filtrar conversaciones por etiqueta en el panel."
    >
      {etiquetas.length > 0 && (
        <ul className="mb-5 flex flex-col gap-2">
          {etiquetas.map((e) => (
            <EtiquetaItem
              key={e.id}
              idCuenta={idCuenta}
              etiqueta={e}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={crear}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Nueva etiqueta
        </p>
        <div className="mb-3 flex gap-3">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Caliente, Comprado, Seguimiento..."
            maxLength={30}
            className={`${inputClases()} flex-1`}
          />
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-900">
            {COLORES_DISPONIBLES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                title={c.id}
                className={`h-5 w-5 rounded-full ${c.clase} transition-all ${
                  color === c.id
                    ? "ring-2 ring-zinc-900 ring-offset-1 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-900"
                    : "opacity-70 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción opcional (ayuda al equipo a saber cuándo usarla)"
          maxLength={120}
          className={`${inputClases()} mb-3`}
        />
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creando || !nombre.trim()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creando ? "Creando..." : "+ Crear etiqueta"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function EtiquetaItem({
  idCuenta,
  etiqueta,
  onCambio,
}: {
  idCuenta: number;
  etiqueta: EtiquetaConCount;
  onCambio: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/etiquetas/${etiqueta.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onCambio();
    } finally {
      setBorrando(false);
      setConfirmando(false);
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${clasesPillEtiqueta(
          etiqueta.color,
        )}`}
      >
        {etiqueta.nombre}
      </span>
      <div className="flex-1 min-w-0">
        {etiqueta.descripcion && (
          <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
            {etiqueta.descripcion}
          </p>
        )}
        <p className="text-[10px] text-zinc-500">
          {etiqueta.total_conversaciones}{" "}
          {etiqueta.total_conversaciones === 1
            ? "conversación"
            : "conversaciones"}
        </p>
      </div>
      {confirmando ? (
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-full px-2 py-0.5 text-[10px] text-zinc-600"
          >
            No
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={borrando}
            className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300"
          >
            {borrando ? "..." : "Sí"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
        >
          Borrar
        </button>
      )}
    </li>
  );
}

// ============================================================
// Sección: Biblioteca de medios (videos / imágenes que la IA puede enviar)
// ============================================================
function SeccionBiblioteca({
  idCuenta,
  medios,
  onCambio,
}: {
  idCuenta: number;
  medios: MedioBiblioteca[];
  onCambio: () => void;
}) {
  const [identificador, setIdentificador] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo || !identificador.trim() || !descripcion.trim() || subiendo)
      return;
    setSubiendo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("identificador", identificador.trim());
      formData.append("descripcion", descripcion.trim());
      const res = await fetch(`/api/cuentas/${idCuenta}/biblioteca`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Error HTTP ${res.status}`);
        return;
      }
      setIdentificador("");
      setDescripcion("");
      setArchivo(null);
      if (refInput.current) refInput.current.value = "";
      onCambio();
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Tarjeta
      titulo="Biblioteca de medios"
      descripcion="Subí imágenes, videos, audios o PDFs que la IA pueda enviar al cliente cuando convenga (catálogos, demos, garantías, etc). El agente decide cuándo enviar cada uno usando la descripción que pongas acá."
    >
      {medios.length > 0 && (
        <ul className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          {medios.map((m) => (
            <MedioBibliotecaItem
              key={m.id}
              idCuenta={idCuenta}
              medio={m}
              onCambio={onCambio}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={subir}
        className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Subir nuevo medio
        </p>
        <input
          type="text"
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          placeholder='Identificador (ej: "catalogo_2025", "demo_acordeon")'
          maxLength={40}
          className={`${inputClases()} mb-3 font-mono`}
        />
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          placeholder="Descripción para que la IA decida cuándo enviarlo. Ej: 'Catálogo completo de acordeones 2025 con precios. Enviar cuando el cliente pregunta por modelos disponibles.'"
          className={`${textareaClases()} mb-3`}
        />
        <input
          ref={refInput}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          className="mb-3 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
        />
        {archivo && (
          <p className="mb-3 text-xs text-zinc-500">
            {archivo.name} —{" "}
            {(archivo.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
        {error && (
          <p className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              subiendo ||
              !archivo ||
              !identificador.trim() ||
              !descripcion.trim()
            }
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {subiendo ? "Subiendo..." : "+ Subir medio"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

function MedioBibliotecaItem({
  idCuenta,
  medio,
  onCambio,
}: {
  idCuenta: number;
  medio: MedioBiblioteca;
  onCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [descripcion, setDescripcion] = useState(medio.descripcion);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    setDescripcion(medio.descripcion);
  }, [medio.id, medio.descripcion]);

  const archivo = medio.ruta_archivo.includes("/")
    ? medio.ruta_archivo.split("/").slice(1).join("/")
    : medio.ruta_archivo;
  const url = `/api/biblioteca/${idCuenta}/${archivo}`;

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/biblioteca/${medio.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descripcion }),
        },
      );
      if (res.ok) {
        setEditando(false);
        onCambio();
      }
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (borrando) return;
    setBorrando(true);
    try {
      const res = await fetch(
        `/api/cuentas/${idCuenta}/biblioteca/${medio.id}`,
        { method: "DELETE" },
      );
      if (res.ok) onCambio();
    } finally {
      setBorrando(false);
      setConfirmando(false);
    }
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      {/* Preview */}
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-950">
        {medio.tipo === "imagen" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={medio.identificador}
            className="h-full w-full object-cover"
          />
        ) : medio.tipo === "video" ? (
          <video src={url} controls className="h-full w-full object-cover" />
        ) : medio.tipo === "audio" ? (
          <div className="flex h-full items-center justify-center p-3">
            <audio src={url} controls className="w-full" />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex h-full items-center justify-center text-xs text-zinc-500 underline"
          >
            Abrir documento
          </a>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase text-white">
          {medio.tipo}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-3">
        <code className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          {medio.identificador}
        </code>
        {editando ? (
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className={textareaClases()}
          />
        ) : (
          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {medio.descripcion}
          </p>
        )}
        <div className="flex items-center justify-end gap-1">
          {editando ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setDescripcion(medio.descripcion);
                }}
                className="rounded-full px-2 py-1 text-[10px] text-zinc-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || !descripcion.trim()}
                className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                {guardando ? "..." : "Guardar"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                Editar descripción
              </button>
              {confirmando ? (
                <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 p-0.5">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="rounded-full px-2 py-0.5 text-[10px] text-zinc-600"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={borrar}
                    disabled={borrando}
                    className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300"
                  >
                    {borrando ? "..." : "Sí"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmando(true)}
                  className="rounded-full px-2 py-1 text-[10px] text-zinc-500 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                >
                  Borrar
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// ============================================================
// Sección: Avanzado (archivar)
// ============================================================
function SeccionAvanzado({ cuenta }: { cuenta: Cuenta }) {
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);

  async function archivar() {
    if (archivando) return;
    setArchivando(true);
    try {
      const res = await fetch(`/api/cuentas/${cuenta.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Volver al panel principal
        window.location.href = "/";
      }
    } finally {
      setArchivando(false);
      setConfirmando(false);
    }
  }

  return (
    <Tarjeta
      titulo="Zona peligrosa"
      descripcion="Archivar la cuenta la oculta del panel y detiene su socket de WhatsApp. Las conversaciones quedan guardadas en la DB pero ya no se muestran."
    >
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">
            ¿Archivar "{cuenta.etiqueta}"?
          </p>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={archivar}
            disabled={archivando}
            className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-red-400 disabled:opacity-50"
          >
            {archivando ? "Archivando..." : "Sí, archivar"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-500/15 dark:text-red-300"
        >
          Archivar cuenta
        </button>
      )}
    </Tarjeta>
  );
}
