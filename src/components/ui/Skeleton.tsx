import type { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  ancho?: string;
  alto?: string;
  redondo?: boolean;
}

export function Skeleton({
  ancho = "100%",
  alto = "1rem",
  redondo = false,
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`skeleton ${redondo ? "rounded-full" : ""} ${className}`}
      style={{ width: ancho, height: alto, ...style }}
      {...rest}
    />
  );
}

export function SkeletonTarjetaKpi() {
  return (
    <div className="rounded-2xl border border-borde bg-superficie p-5">
      <Skeleton ancho="40%" alto="0.75rem" />
      <Skeleton ancho="60%" alto="2rem" className="mt-3" />
      <Skeleton ancho="80%" alto="0.7rem" className="mt-3" />
    </div>
  );
}

export function SkeletonLineas({ filas = 3 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: filas }).map((_, i) => (
        <Skeleton
          key={i}
          ancho={i === filas - 1 ? "70%" : "100%"}
          alto="0.85rem"
        />
      ))}
    </div>
  );
}
