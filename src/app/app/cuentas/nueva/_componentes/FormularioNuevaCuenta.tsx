"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const esquema = z.object({
  etiqueta: z
    .string()
    .min(1, "El nombre es obligatorio")
    .max(60, "Máximo 60 caracteres"),
});
type Datos = z.infer<typeof esquema>;

/**
 * Formulario para crear una cuenta WhatsApp nueva. POST a /api/cuentas
 * y redirect a /app/cuentas/{id}/whatsapp para escanear QR.
 *
 * Maneja explícitamente el error 402 (límite del plan) — el server
 * devuelve `codigo: "limite_plan_alcanzado"` y mostramos un CTA al
 * upgrade. Este caso normalmente no se alcanza porque el server
 * component padre filtra antes, pero está como fallback de seguridad
 * (el conteo se podría desincronizar entre carga y submit).
 */
export function FormularioNuevaCuenta() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mostrarUpgrade, setMostrarUpgrade] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { etiqueta: "" },
  });

  async function crear(datos: Datos) {
    setError(null);
    setMostrarUpgrade(false);
    try {
      const res = await fetch("/api/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: datos.etiqueta.trim() }),
      });
      const data = (await res.json()) as
        | { cuenta: { id: string } }
        | { error: string; codigo?: string };
      if (!res.ok || !("cuenta" in data)) {
        const msg =
          ("error" in data && data.error) ||
          "No pudimos crear la cuenta. Probá de nuevo.";
        setError(msg);
        if ("codigo" in data && data.codigo === "limite_plan_alcanzado") {
          setMostrarUpgrade(true);
        }
        return;
      }
      // Cuenta creada — directo al QR para escanear.
      router.push(`/app/cuentas/${data.cuenta.id}/whatsapp`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <form onSubmit={handleSubmit(crear)} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="etiqueta"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500"
          >
            Nombre del negocio o número
          </label>
          <input
            id="etiqueta"
            type="text"
            {...register("etiqueta")}
            placeholder="Ej: Mi Joyería · Inmobiliaria Centro · Local Palermo"
            maxLength={60}
            autoFocus
            aria-invalid={!!errors.etiqueta}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          {errors.etiqueta ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
              {errors.etiqueta.message}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-zinc-500">
              Solo es una etiqueta interna para identificar la cuenta. La podés
              cambiar después.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-zinc-50 px-4 py-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">
            ¿Qué pasa después?
          </p>
          <ol className="mt-1 ml-4 list-decimal space-y-0.5">
            <li>Creamos la cuenta en tu panel.</li>
            <li>
              Te llevamos a la pantalla de QR — escaneás con tu WhatsApp:{" "}
              <em>Configuración → Dispositivos vinculados</em>.
            </li>
            <li>
              Cuando se conecte, configurás el agente IA, catálogo y empezás
              a recibir mensajes.
            </li>
          </ol>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link
            href="/app"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50"
          >
            {isSubmitting ? "Creando…" : "Crear cuenta y escanear QR →"}
          </button>
        </div>

        {error && (
          <div
            className={`rounded-xl px-3 py-2.5 text-xs ${
              mostrarUpgrade
                ? "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-300"
                : "border border-red-300 bg-red-50 text-red-700 dark:border-red-700/40 dark:bg-red-900/10 dark:text-red-300"
            }`}
            role="alert"
          >
            <p>{error}</p>
            {mostrarUpgrade && (
              <Link
                href="/app/mi-cuenta/upgrade"
                className="mt-2 inline-block rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-400"
              >
                Ver planes →
              </Link>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
