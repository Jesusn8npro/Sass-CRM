import type { ReactNode } from "react";

interface EstadoVacioProps {
  icono?: ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  tamano?: "sm" | "md" | "lg";
}

const TAMANOS = {
  sm: "py-8 px-4",
  md: "py-12 px-6",
  lg: "py-16 px-8",
} as const;

export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  tamano = "md",
}: EstadoVacioProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-borde bg-superficie-suave/60 text-center ${TAMANOS[tamano]}`}
    >
      {icono && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-marca-500/10 text-marca-600 dark:text-marca-300">
          {icono}
        </div>
      )}
      <h3 className="text-sm font-semibold tracking-tight text-texto">
        {titulo}
      </h3>
      {descripcion && (
        <p className="mt-1 max-w-sm text-xs text-texto-suave">{descripcion}</p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
