"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Etiqueta,
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
} from "./compartido";

const esquemaIdentidad = z.object({
  etiqueta: z.string().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  agente_nombre: z.string().max(60, "Máximo 60 caracteres"),
  agente_rol: z.string().max(80, "Máximo 80 caracteres"),
});
type DatosIdentidad = z.infer<typeof esquemaIdentidad>;

export function SeccionIdentidad({ cuenta, onActualizada }: PropsSeccionBase) {
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DatosIdentidad>({
    resolver: zodResolver(esquemaIdentidad),
    defaultValues: { etiqueta: cuenta.etiqueta, agente_nombre: cuenta.agente_nombre, agente_rol: cuenta.agente_rol },
  });

  useEffect(() => {
    reset({ etiqueta: cuenta.etiqueta, agente_nombre: cuenta.agente_nombre, agente_rol: cuenta.agente_rol });
    setError(null);
    setExito(false);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(datos: DatosIdentidad) {
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, { etiqueta: datos.etiqueta.trim(), agente_nombre: datos.agente_nombre.trim(), agente_rol: datos.agente_rol.trim() });
    if ("error" in r) setError(r.error);
    else { onActualizada(r); setExito(true); setTimeout(() => setExito(false), 2500); }
  }

  const fieldClases = (conError: boolean) => `${inputClases()} ${conError ? "border-red-500 focus:border-red-500 focus:ring-red-500/15" : ""}`;

  return (
    <Tarjeta titulo="Identidad del Agente" descripcion="Define quién es tu agente virtual y cómo se presenta al cliente.">
      <form onSubmit={handleSubmit(guardar)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Etiqueta>Nombre del Agente</Etiqueta>
            <input type="text" {...register("agente_nombre")} placeholder="Eryum" maxLength={60} aria-invalid={!!errors.agente_nombre} className={fieldClases(!!errors.agente_nombre)} />
            {errors.agente_nombre
              ? <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.agente_nombre.message}</p>
              : <p className="mt-1.5 text-xs text-zinc-500">Ej: Ana, Carlos, Sofía, Asistente Virtual</p>}
          </div>
          <div>
            <Etiqueta>Rol del Agente</Etiqueta>
            <input type="text" {...register("agente_rol")} placeholder="asistente de ventas" maxLength={80} aria-invalid={!!errors.agente_rol} className={fieldClases(!!errors.agente_rol)} />
            {errors.agente_rol
              ? <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.agente_rol.message}</p>
              : <p className="mt-1.5 text-xs text-zinc-500">Ej: asistente de ventas, asesor inmobiliario, soporte técnico</p>}
          </div>
        </div>
        <div>
          <Etiqueta>Nombre interno de la cuenta</Etiqueta>
          <input type="text" {...register("etiqueta")} maxLength={60} aria-invalid={!!errors.etiqueta} className={fieldClases(!!errors.etiqueta)} />
          {errors.etiqueta
            ? <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.etiqueta.message}</p>
            : <p className="mt-1.5 text-xs text-zinc-500">Solo lo ves vos en el panel — no lo ve el cliente.</p>}
        </div>
        <div className="flex items-center justify-between gap-3">
          <MensajeEstado exito={exito} error={error} />
          {botonGuardar({ guardando: isSubmitting })}
        </div>
      </form>
    </Tarjeta>
  );
}
