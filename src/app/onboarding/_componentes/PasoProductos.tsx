"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toaster";

interface FilaProducto {
  nombre: string;
  precio: string;
  descripcion: string;
}

const FILA_VACIA: FilaProducto = { nombre: "", precio: "", descripcion: "" };

/**
 * Paso 3 — Cargar 3 productos/servicios. 3 filas de inputs simples.
 * Skip opcional. Validación: al menos un nombre para guardar; si todo
 * está vacío y no es ecommerce, sugerimos saltar.
 */
export function PasoProductos({ idCuenta }: { idCuenta: string }) {
  const router = useRouter();
  const toast = useToast();
  const [filas, setFilas] = useState<FilaProducto[]>([
    { ...FILA_VACIA },
    { ...FILA_VACIA },
    { ...FILA_VACIA },
  ]);
  const [guardando, setGuardando] = useState(false);

  function actualizar(i: number, campo: keyof FilaProducto, valor: string) {
    setFilas((prev) => {
      const next = [...prev];
      next[i] = { ...next[i]!, [campo]: valor };
      return next;
    });
  }

  async function guardar() {
    if (guardando) return;
    const validas = filas.filter((f) => f.nombre.trim().length > 0);
    if (validas.length === 0) {
      toast.error(
        "Cargá al menos un producto o servicio (o saltá este paso).",
      );
      return;
    }
    setGuardando(true);
    let creados = 0;
    try {
      for (const fila of validas) {
        const precioNum = fila.precio.trim()
          ? Number(fila.precio.replace(",", "."))
          : null;
        const res = await fetch(`/api/cuentas/${idCuenta}/productos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: fila.nombre.trim(),
            descripcion: fila.descripcion.trim(),
            precio: precioNum && !Number.isNaN(precioNum) ? precioNum : null,
          }),
        });
        if (res.ok) creados += 1;
      }
      if (creados === 0) {
        toast.error("No pudimos crear los productos. Probá de nuevo.");
        return;
      }
      toast.exito(
        creados === 1
          ? "Producto guardado"
          : `${creados} productos guardados`,
      );
      await marcarPaso("probar");
      router.replace("/onboarding/probar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  async function saltar() {
    await marcarPaso("probar");
    router.replace("/onboarding/probar");
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400/80">
        03 — Productos
      </p>
      <h1 className="font-display mt-2 text-3xl italic leading-tight tracking-tight sm:text-5xl">
        Cargá tus 3 principales
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
        El agente usa estos productos o servicios para responder consultas
        de precio y stock. Si no es relevante para tu negocio, podés
        saltar este paso.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {filas.map((fila, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5"
          >
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
              Producto / servicio {i + 1}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_2fr]">
              <input
                type="text"
                placeholder="Nombre"
                value={fila.nombre}
                onChange={(e) => actualizar(i, "nombre", e.target.value)}
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="Precio"
                value={fila.precio}
                onChange={(e) => actualizar(i, "precio", e.target.value)}
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
              <input
                type="text"
                placeholder="Descripción corta"
                value={fila.descripcion}
                onChange={(e) =>
                  actualizar(i, "descripcion", e.target.value)
                }
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={saltar}
          disabled={guardando}
          className="font-mono text-xs uppercase tracking-[0.18em] text-white/50 hover:text-white/80 disabled:opacity-50"
        >
          Saltar este paso →
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-full bg-emerald-400 px-6 py-3.5 text-base font-semibold text-black shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-300 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar y continuar"}
        </button>
      </div>
    </div>
  );
}

async function marcarPaso(paso: string) {
  try {
    await fetch("/api/onboarding/paso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paso }),
    });
  } catch {
    /* no bloquea */
  }
}
