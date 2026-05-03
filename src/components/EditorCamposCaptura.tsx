"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampoCaptura } from "@/lib/baseDatos";

interface Props {
  idCuenta: string;
  valorInicial: CampoCaptura[];
  onGuardado?: (nuevos: CampoCaptura[]) => void;
}

interface Plantilla {
  clave: string;
  label: string;
  descripcion: string;
  obligatorio: boolean;
  pregunta_sugerida: string;
}

const PLANTILLAS: Plantilla[] = [
  {
    clave: "ciudad",
    label: "Ciudad",
    descripcion: "Ciudad / país donde reside o tiene su negocio el cliente.",
    obligatorio: false,
    pregunta_sugerida: "¿En qué ciudad estás?",
  },
  {
    clave: "presupuesto",
    label: "Presupuesto",
    descripcion: "Rango de presupuesto que maneja el cliente para esta compra.",
    obligatorio: false,
    pregunta_sugerida:
      "Para armarte la mejor opción, ¿qué presupuesto manejás más o menos?",
  },
  {
    clave: "tamano_equipo",
    label: "Tamaño del equipo",
    descripcion: "Cuántas personas trabajan en su empresa o equipo.",
    obligatorio: false,
    pregunta_sugerida: "¿Cuántas personas trabajan en tu equipo?",
  },
  {
    clave: "fecha_inicio",
    label: "Fecha estimada de inicio",
    descripcion: "Cuándo necesita o le gustaría empezar a usar el servicio.",
    obligatorio: false,
    pregunta_sugerida: "¿Para cuándo te interesaría arrancar?",
  },
  {
    clave: "como_nos_conocio",
    label: "Cómo nos conoció",
    descripcion: "Por dónde llegó: anuncio Facebook, recomendación, Google, etc.",
    obligatorio: false,
    pregunta_sugerida: "Antes de seguir, ¿cómo llegaste a nosotros?",
  },
  {
    clave: "industria",
    label: "Industria",
    descripcion: "Sector o industria del negocio del cliente.",
    obligatorio: false,
    pregunta_sugerida: "¿En qué industria está tu negocio?",
  },
];

function slugificar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function EditorCamposCaptura({
  idCuenta,
  valorInicial,
  onGuardado,
}: Props) {
  const [campos, setCampos] = useState<CampoCaptura[]>(valorInicial);
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Si el server reenvía un valorInicial distinto (ej. después de guardar),
  // resetear el estado local. Comparamos por JSON.stringify para evitar
  // resets infinitos cuando el padre crea un array nuevo en cada render.
  const claveInicial = JSON.stringify(valorInicial);
  useEffect(() => {
    setCampos(valorInicial);
    setEstado("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveInicial]);

  const dirty = useMemo(() => {
    return JSON.stringify(campos) !== JSON.stringify(valorInicial);
  }, [campos, valorInicial]);

  const clavesUsadas = useMemo(
    () => new Set(campos.map((c) => c.clave)),
    [campos],
  );

  function agregarVacio() {
    setCampos((prev) => [
      ...prev,
      {
        clave: "",
        label: "",
        descripcion: "",
        obligatorio: false,
        pregunta_sugerida: "",
        orden: (prev.length + 1) * 10,
      },
    ]);
  }

  function agregarPlantilla(p: Plantilla) {
    if (clavesUsadas.has(p.clave)) return;
    setCampos((prev) => [
      ...prev,
      { ...p, orden: (prev.length + 1) * 10 },
    ]);
  }

  function actualizar(idx: number, parche: Partial<CampoCaptura>) {
    setCampos((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...parche } : c)),
    );
  }

  function borrar(idx: number) {
    setCampos((prev) => prev.filter((_, i) => i !== idx));
  }

  function mover(idx: number, dir: -1 | 1) {
    setCampos((prev) => {
      const nuevo = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= nuevo.length) return prev;
      [nuevo[idx], nuevo[j]] = [nuevo[j]!, nuevo[idx]!];
      return nuevo;
    });
  }

  async function guardar() {
    setGuardando(true);
    setEstado("idle");
    setMensaje(null);
    try {
      // Sanitizar antes de enviar: clave/label vacíos se descartan.
      // El orden se asigna por posición en el array (incremental ×10)
      // para que el reordenado con flechas sea persistente.
      const limpio = campos
        .map((c, idx) => ({
          clave: slugificar(c.clave),
          label: c.label.trim() || c.clave,
          descripcion: c.descripcion.trim(),
          obligatorio: c.obligatorio,
          pregunta_sugerida: (c.pregunta_sugerida ?? "").trim(),
          orden: (idx + 1) * 10,
        }))
        .filter((c) => c.clave.length > 0);

      const res = await fetch(`/api/cuentas/${idCuenta}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campos_a_capturar: limpio }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setEstado("error");
        setMensaje(data.error ?? `Error ${res.status}`);
        return;
      }
      const data = (await res.json()) as {
        cuenta?: { campos_a_capturar?: CampoCaptura[] };
      };
      const aplicados = data.cuenta?.campos_a_capturar ?? limpio;
      setCampos(aplicados);
      setEstado("ok");
      setMensaje(
        aplicados.length === 0
          ? "Listo — sin campos custom (la IA usa solo los core)."
          : `${aplicados.length} campo${aplicados.length === 1 ? "" : "s"} guardado${aplicados.length === 1 ? "" : "s"}.`,
      );
      onGuardado?.(aplicados);
    } catch (err) {
      setEstado("error");
      setMensaje(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  const plantillasDisponibles = PLANTILLAS.filter(
    (p) => !clavesUsadas.has(p.clave),
  );

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Captura de datos
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">
            Campos personalizados que la IA debe capturar
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            Aparte de los datos core (nombre, email, teléfono, interés, negocio,
            ventajas, miedos) que la IA captura por defecto, podés agregar acá
            los campos extra propios de tu negocio. La IA los va a preguntar de
            forma natural durante la conversación y guardarlos en el perfil del
            cliente.
          </p>
        </div>
      </div>

      {/* Plantillas rápidas */}
      {plantillasDisponibles.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Agregar rápido
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plantillasDisponibles.map((p) => (
              <button
                key={p.clave}
                type="button"
                onClick={() => agregarPlantilla(p)}
                className="rounded-full border border-dashed border-zinc-300 bg-white px-3 py-1 text-[11px] font-medium text-zinc-600 transition-all hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-emerald-950/30"
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de campos */}
      <div className="mt-5 space-y-3">
        {campos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Aún no hay campos personalizados
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Usá las plantillas de arriba o tocá &quot;+ Agregar vacío&quot;
              para empezar.
            </p>
          </div>
        ) : (
          campos.map((campo, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-950/30"
            >
              {/* Header del campo: número de orden + label resumen */}
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  {idx + 1}
                </span>
                <p className="flex-1 truncate text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {campo.label || campo.clave || "(campo sin nombre)"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Clave (slug interno)
                  </label>
                  <input
                    type="text"
                    value={campo.clave}
                    onChange={(e) =>
                      actualizar(idx, { clave: slugificar(e.target.value) })
                    }
                    placeholder="ej. ciudad"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Label (visible)
                  </label>
                  <input
                    type="text"
                    value={campo.label}
                    onChange={(e) => actualizar(idx, { label: e.target.value })}
                    placeholder="ej. Ciudad"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div className="md:col-span-6">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Descripción (pista para la IA)
                  </label>
                  <input
                    type="text"
                    value={campo.descripcion}
                    onChange={(e) =>
                      actualizar(idx, { descripcion: e.target.value })
                    }
                    placeholder="ej. Ciudad donde vive el cliente"
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
              </div>

              {/* Pregunta sugerida — la IA usa esto como referencia para
                  pedir el dato de forma natural. Lo más impactante. */}
              <div className="mt-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  💬 Pregunta sugerida — cómo la IA debe pedir este dato
                </label>
                <input
                  type="text"
                  value={campo.pregunta_sugerida ?? ""}
                  onChange={(e) =>
                    actualizar(idx, { pregunta_sugerida: e.target.value })
                  }
                  placeholder="ej. ¿En qué ciudad estás organizando el evento?"
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 dark:border-zinc-800 dark:bg-zinc-900"
                />
                <p className="mt-1 text-[10px] text-zinc-500">
                  La IA va a usar esta pregunta (o una variación natural) cuando
                  necesite capturar este dato. Dejala vacía si querés que la IA improvise.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={campo.obligatorio}
                    onChange={(e) =>
                      actualizar(idx, { obligatorio: e.target.checked })
                    }
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-medium">Obligatorio</span>
                  <span className="text-zinc-500">
                    — la IA prioriza capturarlo antes de cerrar
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => mover(idx, -1)}
                    disabled={idx === 0}
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(idx, 1)}
                    disabled={idx === campos.length - 1}
                    className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 disabled:opacity-30 dark:hover:bg-zinc-800"
                    title="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => borrar(idx)}
                    className="rounded-md p-1 text-red-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/40"
                    title="Borrar campo"
                  >
                    ✗
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer: agregar vacío + guardar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={agregarVacio}
          className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium hover:border-emerald-500/40 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900"
        >
          + Agregar vacío
        </button>

        <div className="flex items-center gap-2">
          {estado === "ok" && (
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              ✓ {mensaje}
            </span>
          )}
          {estado === "error" && (
            <span className="text-[11px] font-medium text-red-600">
              ✗ {mensaje}
            </span>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={!dirty || guardando}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </section>
  );
}
