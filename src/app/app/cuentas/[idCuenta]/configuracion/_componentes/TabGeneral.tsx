"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  Cuenta,
  EntradaConocimiento,
} from "@/lib/baseDatos";
import { WizardChatConfig } from "@/components/WizardChatConfig";
import {
  Campo,
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
  textareaClases,
} from "./compartido";

const TONOS_AGENTE: { id: Cuenta["agente_tono"]; label: string }[] = [
  { id: "casual_amigable", label: "Casual y amigable" },
  { id: "formal", label: "Formal y respetuoso" },
  { id: "profesional", label: "Profesional y consultivo" },
  { id: "cercano", label: "Cercano (como un amigo)" },
  { id: "directo", label: "Directo y eficiente" },
  { id: "consultivo", label: "Consultivo (escucha primero)" },
];

const IDIOMAS = [
  { id: "es", label: "Español neutro" },
  { id: "es-AR", label: "Español rioplatense (Argentina)" },
  { id: "es-CO", label: "Español colombiano" },
  { id: "es-MX", label: "Español mexicano" },
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
];

export function SeccionIdentidad({ cuenta, onActualizada }: PropsSeccionBase) {
  const [etiqueta, setEtiqueta] = useState(cuenta.etiqueta);
  const [agenteNombre, setAgenteNombre] = useState(cuenta.agente_nombre);
  const [agenteRol, setAgenteRol] = useState(cuenta.agente_rol);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setEtiqueta(cuenta.etiqueta);
    setAgenteNombre(cuenta.agente_nombre);
    setAgenteRol(cuenta.agente_rol);
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
      agente_nombre: agenteNombre.trim(),
      agente_rol: agenteRol.trim(),
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
      titulo="Identidad del Agente"
      descripcion="Define quién es tu agente virtual y cómo se presenta al cliente."
    >
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Etiqueta>Nombre del Agente</Etiqueta>
            <input
              type="text"
              value={agenteNombre}
              onChange={(e) => setAgenteNombre(e.target.value)}
              placeholder="Eryum"
              maxLength={60}
              className={inputClases()}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Ej: Ana, Carlos, Sofía, Asistente Virtual
            </p>
          </div>
          <div>
            <Etiqueta>Rol del Agente</Etiqueta>
            <input
              type="text"
              value={agenteRol}
              onChange={(e) => setAgenteRol(e.target.value)}
              placeholder="asistente de ventas"
              maxLength={80}
              className={inputClases()}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Ej: asistente de ventas, asesor inmobiliario, soporte técnico
            </p>
          </div>
        </div>
        <div>
          <Etiqueta>Nombre interno de la cuenta</Etiqueta>
          <input
            type="text"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            required
            maxLength={60}
            className={inputClases()}
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            Solo lo ves vos en el panel — no lo ve el cliente.
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

const MODOS_RESPUESTA: {
  id: Cuenta["modo_respuesta"];
  label: string;
  descripcion: string;
}[] = [
  {
    id: "mixto",
    label: "Mixto (recomendado)",
    descripcion: "Mayoría texto + audios e imágenes ocasionales para variar.",
  },
  {
    id: "solo_texto",
    label: "Solo texto",
    descripcion: "Nunca audio ni medios. Estilo conversacional escrito.",
  },
  {
    id: "solo_audio",
    label: "Solo audio",
    descripcion: "Siempre intenta nota de voz. Datos exactos en texto aparte.",
  },
  {
    id: "espejo_voz",
    label: "Espejo de voz",
    descripcion: "Audio si el cliente envió audio; texto si el cliente escribió.",
  },
];

export function SeccionEstilo({ cuenta, onActualizada }: PropsSeccionBase) {
  const [personalidad, setPersonalidad] = useState(cuenta.agente_personalidad);
  const [idioma, setIdioma] = useState(cuenta.agente_idioma);
  const [tono, setTono] = useState<Cuenta["agente_tono"]>(cuenta.agente_tono);
  const [modoRespuesta, setModoRespuesta] = useState<Cuenta["modo_respuesta"]>(
    cuenta.modo_respuesta ?? "mixto",
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setPersonalidad(cuenta.agente_personalidad);
    setIdioma(cuenta.agente_idioma);
    setTono(cuenta.agente_tono);
    setModoRespuesta(cuenta.modo_respuesta ?? "mixto");
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar() {
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      agente_personalidad: personalidad,
      agente_idioma: idioma,
      agente_tono: tono,
      modo_respuesta: modoRespuesta,
    });
    setGuardando(false);
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setExito(true);
      setTimeout(() => setExito(false), 1500);
    }
  }

  return (
    <Tarjeta
      titulo="Estilo de Comunicación"
      descripcion="Cómo debe hablar y comportarse el agente."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Campo label="Personalidad">
          <input
            type="text"
            value={personalidad}
            onChange={(e) => setPersonalidad(e.target.value)}
            placeholder="profesional, amable y entusiasta"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          />
        </Campo>
        <Campo label="Idioma">
          <select
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {IDIOMAS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Tono">
          <select
            value={tono}
            onChange={(e) =>
              setTono(e.target.value as Cuenta["agente_tono"])
            }
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {TONOS_AGENTE.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="mt-5">
        <Campo
          label="Estilo de respuestas"
          hint={
            MODOS_RESPUESTA.find((m) => m.id === modoRespuesta)?.descripcion
          }
        >
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {MODOS_RESPUESTA.map((m) => {
              const activo = modoRespuesta === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModoRespuesta(m.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    activo
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </Campo>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <MensajeEstado exito={exito} error={error} />
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Tarjeta>
  );
}


export function SeccionContexto({ cuenta, onActualizada }: PropsSeccionBase) {
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

export function BannerConocimiento({
  idCuenta,
  count,
}: {
  idCuenta: string;
  count: number;
}) {
  return (
    <Link
      href={`/app/cuentas/${idCuenta}/conocimiento`}
      className="group relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-violet-500/30 dark:from-violet-950/40 dark:to-indigo-950/40"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-xl text-white shadow-md">
            📚
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
              Base de conocimiento
            </p>
            <h3 className="mt-0.5 text-base font-bold tracking-tight">
              {count > 0
                ? `${count} documento${count === 1 ? "" : "s"} cargado${count === 1 ? "" : "s"}`
                : "Aún no hay documentos cargados"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              Subí información (productos, FAQs, políticas) para que tu agente
              pueda responder con datos reales del negocio.
            </p>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm group-hover:bg-violet-700 md:inline-flex">
          Ir a Conocimiento →
        </span>
      </div>
    </Link>
  );
}

export function TabGeneral({
  cuenta,
  setCuenta,
  conocimiento,
}: {
  cuenta: Cuenta;
  setCuenta: (c: Cuenta) => void;
  conocimiento: EntradaConocimiento[];
}) {
  const [wizardAbierto, setWizardAbierto] = useState(false);

  async function recargarCuenta() {
    try {
      const r = await fetch(`/api/cuentas/${cuenta.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { cuenta: Cuenta };
      setCuenta(d.cuenta);
    } catch {
      /* ignorar */
    }
  }

  return (
    <>
      <BannerWizard onAbrir={() => setWizardAbierto(true)} />
      <SeccionIdentidad cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionEstilo cuenta={cuenta} onActualizada={setCuenta} />
      <SeccionContexto cuenta={cuenta} onActualizada={setCuenta} />
      <BannerConocimiento idCuenta={cuenta.id} count={conocimiento.length} />
      <WizardChatConfig
        idCuenta={cuenta.id}
        abierto={wizardAbierto}
        onCerrar={() => setWizardAbierto(false)}
        onCompletado={() => {
          setWizardAbierto(false);
          void recargarCuenta();
        }}
      />
    </>
  );
}

function BannerWizard({ onAbrir }: { onAbrir: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Modo express
          </p>
          <h3 className="mt-0.5 text-sm font-bold">
            ⚡ Configurá tu agente conversando con la IA
          </h3>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            Te hace preguntas y va llenando los campos. Después podés
            ajustar lo que quieras manualmente acá abajo.
          </p>
        </div>
        <button
          type="button"
          onClick={onAbrir}
          className="shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-400"
        >
          Abrir chat →
        </button>
      </div>
    </div>
  );
}
