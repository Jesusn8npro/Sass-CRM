import type { HTMLAttributes } from "react";

type Variante =
  | "neutral"
  | "marca"
  | "exito"
  | "aviso"
  | "peligro"
  | "info"
  | "contorno";

interface EtiquetaProps extends HTMLAttributes<HTMLSpanElement> {
  variante?: Variante;
  punto?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  neutral:
    "bg-superficie-elevada text-texto-suave border border-borde",
  marca:
    "bg-marca-500/10 text-marca-700 dark:text-marca-300 border border-marca-500/20",
  exito:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  aviso:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  peligro:
    "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20",
  info:
    "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20",
  contorno:
    "bg-transparent text-texto-suave border border-borde",
};

const PUNTOS: Record<Variante, string> = {
  neutral: "bg-texto-tenue",
  marca: "bg-marca-500",
  exito: "bg-emerald-500",
  aviso: "bg-amber-500",
  peligro: "bg-red-500",
  info: "bg-sky-500",
  contorno: "bg-texto-tenue",
};

export function Etiqueta({
  variante = "neutral",
  punto = false,
  className = "",
  children,
  ...rest
}: EtiquetaProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${VARIANTES[variante]} ${className}`}
      {...rest}
    >
      {punto && (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${PUNTOS[variante]}`}
        />
      )}
      {children}
    </span>
  );
}
