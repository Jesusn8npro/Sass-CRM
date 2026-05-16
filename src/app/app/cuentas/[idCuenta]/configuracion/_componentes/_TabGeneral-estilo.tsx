"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Cuenta } from "@/lib/baseDatos";
import {
  Campo,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  textareaClases,
  patchCuenta,
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

const MODOS_RESPUESTA: { id: Cuenta["modo_respuesta"]; label: string; descripcion: string }[] = [
  { id: "mixto", label: "Mixto (recomendado)", descripcion: "Mayoría texto + audios e imágenes ocasionales para variar." },
  { id: "solo_texto", label: "Solo texto", descripcion: "Nunca audio ni medios. Estilo conversacional escrito." },
  { id: "solo_audio", label: "Solo audio", descripcion: "Siempre intenta nota de voz. Datos exactos en texto aparte." },
  { id: "espejo_voz", label: "Espejo de voz", descripcion: "Audio si el cliente envió audio; texto si el cliente escribió." },
];

const esquemaEstilo = z.object({
  agente_personalidad: z.string().max(200, "Máximo 200 caracteres"),
  agente_idioma: z.string().min(1),
  agente_tono: z.string().min(1),
  modo_respuesta: z.string().min(1),
});
type DatosEstilo = z.infer<typeof esquemaEstilo>;

export function SeccionEstilo({ cuenta, onActualizada }: PropsSeccionBase) {
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<DatosEstilo>({
    resolver: zodResolver(esquemaEstilo),
    defaultValues: {
      agente_personalidad: cuenta.agente_personalidad,
      agente_idioma: cuenta.agente_idioma,
      agente_tono: cuenta.agente_tono,
      modo_respuesta: cuenta.modo_respuesta ?? "mixto",
    },
  });

  const modoRespuesta = watch("modo_respuesta");

  useEffect(() => {
    reset({
      agente_personalidad: cuenta.agente_personalidad,
      agente_idioma: cuenta.agente_idioma,
      agente_tono: cuenta.agente_tono,
      modo_respuesta: cuenta.modo_respuesta ?? "mixto",
    });
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(datos: DatosEstilo) {
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      agente_personalidad: datos.agente_personalidad,
      agente_idioma: datos.agente_idioma,
      agente_tono: datos.agente_tono as Cuenta["agente_tono"],
      modo_respuesta: datos.modo_respuesta as Cuenta["modo_respuesta"],
    });
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 1500); }
  }

  return (
    <Tarjeta titulo="Estilo de Comunicación" descripcion="Cómo debe hablar y comportarse el agente.">
      <form onSubmit={handleSubmit(guardar)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label="Personalidad">
            <input type="text" {...register("agente_personalidad")} placeholder="profesional, amable y entusiasta" aria-invalid={!!errors.agente_personalidad} className={`w-full rounded-lg border px-3 py-2 text-sm dark:bg-zinc-900 ${errors.agente_personalidad ? "border-red-500" : "border-zinc-200 dark:border-zinc-800 bg-white"}`} />
            {errors.agente_personalidad && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.agente_personalidad.message}</p>}
          </Campo>
          <Campo label="Idioma">
            <select {...register("agente_idioma")} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
          </Campo>
          <Campo label="Tono">
            <select {...register("agente_tono")} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {TONOS_AGENTE.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Campo>
        </div>

        <div className="mt-5">
          <Campo label="Estilo de respuestas" hint={MODOS_RESPUESTA.find((m) => m.id === modoRespuesta)?.descripcion}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {MODOS_RESPUESTA.map((m) => {
                const activo = modoRespuesta === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setValue("modo_respuesta", m.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${activo ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/40"}`}
                  >{m.label}</button>
                );
              })}
            </div>
          </Campo>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <MensajeEstado exito={exito} error={error} />
          <button type="submit" disabled={isSubmitting} className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {isSubmitting ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}

const esquemaContexto = z.object({ contexto_negocio: z.string().max(10000, "Máximo 10000 caracteres") });
type DatosContexto = z.infer<typeof esquemaContexto>;

export function SeccionContexto({ cuenta, onActualizada }: PropsSeccionBase) {
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DatosContexto>({
    resolver: zodResolver(esquemaContexto),
    defaultValues: { contexto_negocio: cuenta.contexto_negocio },
  });

  useEffect(() => {
    reset({ contexto_negocio: cuenta.contexto_negocio });
    setError(null);
    setExito(false);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(datos: DatosContexto) {
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, { contexto_negocio: datos.contexto_negocio });
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 2500); }
  }

  return (
    <Tarjeta titulo="Información del negocio (hechos)" descripcion="DATOS objetivos sobre tu negocio: qué vendés, dónde, horarios, formas de pago, garantías, políticas. NO confundir con el Prompt del agente — eso va en la pestaña 'Configuración IA' y define el COMPORTAMIENTO (cómo responde, qué tono, qué reglas). Acá solo van HECHOS.">
      <form onSubmit={handleSubmit(guardar)} className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          ✅ <strong>Va acá:</strong> dirección, horarios, métodos de pago, garantías, envío, devoluciones, condiciones del servicio, datos de contacto.<br />
          ❌ <strong>NO va acá:</strong> "el agente debe ser amable", "no des descuentos", "siempre cierra ofreciendo demo" — eso son reglas de comportamiento, van al Prompt del agente (Configuración IA).
        </p>
        <textarea {...register("contexto_negocio")} rows={10} placeholder={`Vendemos acordeones nuevos y usados.\nEstamos en Bogotá, Colombia. Enviamos a todo el país.\nAceptamos pago contra entrega, transferencia y tarjeta.\nGarantía de 1 año contra defectos de fábrica.\nHorario: L-V 9am a 6pm, S 10am a 2pm.`} aria-invalid={!!errors.contexto_negocio} className={`${textareaClases()} ${errors.contexto_negocio ? "border-red-500" : ""}`} />
        {errors.contexto_negocio && <p className="text-xs text-red-600 dark:text-red-400" role="alert">{errors.contexto_negocio.message}</p>}
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando: isSubmitting })}
        </div>
      </form>
    </Tarjeta>
  );
}
