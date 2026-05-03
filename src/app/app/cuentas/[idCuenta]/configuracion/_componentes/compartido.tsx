"use client";

import type { Cuenta } from "@/lib/baseDatos";

export interface PropsSeccionBase {
  cuenta: Cuenta;
  onActualizada: (cuenta: Cuenta) => void;
}

export function CargandoOError({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <span className="h-2 w-2 animate-pulso-suave rounded-full bg-zinc-400 dark:bg-zinc-600" />
        {mensaje}
      </div>
    </main>
  );
}

export function Tarjeta({
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

export function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </label>
  );
}

export function inputClases(): string {
  return "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600";
}

export function textareaClases(): string {
  return `${inputClases()} resize-y font-mono text-xs leading-relaxed`;
}

export function botonGuardar({
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

export function MensajeEstado({
  exito,
  error,
}: {
  exito: boolean;
  error: string | null;
}) {
  if (error) {
    return <p className="text-xs text-red-700 dark:text-red-300">{error}</p>;
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

export async function patchCuenta(
  idCuenta: string,
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
        error: (data as { error?: string }).error ?? "Error guardando cambios",
      };
    }
    return (data as { cuenta: Cuenta }).cuenta;
  } catch {
    return { error: "Error de red" };
  }
}

export function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}
