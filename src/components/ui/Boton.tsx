import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "peligro" | "marca-suave";
type Tamano = "sm" | "md" | "lg";

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  iconoIzq?: ReactNode;
  iconoDer?: ReactNode;
  cargando?: boolean;
  bloque?: boolean;
}

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-superficie disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-marca-400 text-black hover:bg-marca-300 shadow-[var(--shadow-glow-marca-sm)] hover:shadow-[var(--shadow-glow-marca)] focus-visible:ring-marca-400",
  secundario:
    "border border-borde bg-superficie text-texto hover:border-borde-fuerte hover:bg-superficie-suave focus-visible:ring-borde-fuerte",
  fantasma:
    "text-texto-suave hover:bg-superficie-suave hover:text-texto focus-visible:ring-borde",
  peligro:
    "bg-peligro text-white hover:opacity-90 focus-visible:ring-peligro",
  "marca-suave":
    "bg-marca-500/10 text-marca-700 hover:bg-marca-500/15 dark:text-marca-300 focus-visible:ring-marca-400",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 px-3 text-xs rounded-full",
  md: "h-10 px-4 text-sm rounded-full",
  lg: "h-12 px-6 text-base rounded-full",
};

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  {
    variante = "primario",
    tamano = "md",
    iconoIzq,
    iconoDer,
    cargando = false,
    bloque = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || cargando}
      className={`${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${bloque ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {cargando ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        iconoIzq
      )}
      {children}
      {iconoDer}
    </button>
  );
});
