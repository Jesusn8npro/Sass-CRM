import type { HTMLAttributes, ReactNode } from "react";

interface TarjetaProps extends HTMLAttributes<HTMLDivElement> {
  variante?: "default" | "elevada" | "marca";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const VARIANTES = {
  default: "border border-borde bg-superficie",
  elevada: "border border-borde bg-superficie shadow-sm",
  marca:
    "border border-marca-500/20 bg-gradient-to-br from-marca-500/[0.04] to-transparent",
} as const;

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
} as const;

export function Tarjeta({
  variante = "default",
  padding = "md",
  hover = false,
  className = "",
  children,
  ...rest
}: TarjetaProps) {
  return (
    <div
      className={`rounded-2xl ${VARIANTES[variante]} ${PADDING[padding]} ${
        hover
          ? "transition-all hover:-translate-y-0.5 hover:border-marca-500/40 hover:shadow-md"
          : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function TarjetaEncabezado({
  titulo,
  descripcion,
  accion,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-texto">
          {titulo}
        </h3>
        {descripcion && (
          <p className="mt-0.5 text-xs text-texto-suave">{descripcion}</p>
        )}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}
