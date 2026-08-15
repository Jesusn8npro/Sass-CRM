"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CLAVES_PISO,
  PLAYBOOK_BASE,
  pisoFaltante,
  type ClavePiso,
  type ObjecionPlaybook,
} from "@/lib/playbook";
import {
  MensajeEstado,
  PropsSeccionBase,
  Tarjeta,
  botonGuardar,
  inputClases,
  patchCuenta,
  textareaClases,
} from "./compartido";

const ETIQUETA_PISO: Record<ClavePiso, string> = {
  descuento: "Descuentos",
  garantia: "Garantías",
};

function clonarBase(): ObjecionPlaybook[] {
  return PLAYBOOK_BASE.map((o) => ({ ...o }));
}

export function SeccionPlaybook({ cuenta, onActualizada }: PropsSeccionBase) {
  const [objeciones, setObjeciones] = useState<ObjecionPlaybook[]>(
    () => cuenta.playbook_objeciones ?? [],
  );
  const [activo, setActivo] = useState(cuenta.playbook_activo === true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    setObjeciones(cuenta.playbook_objeciones ?? []);
    setActivo(cuenta.playbook_activo === true);
    setError(null);
    setExito(false);
  }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const faltan = useMemo(() => pisoFaltante(objeciones), [objeciones]);
  const completas = objeciones.filter(
    (o) => o.objecion.trim() && o.respuesta.trim(),
  ).length;

  function actualizar(i: number, campo: keyof ObjecionPlaybook, valor: string) {
    setObjeciones((prev) =>
      prev.map((o, idx) => (idx === i ? { ...o, [campo]: valor } : o)),
    );
    setExito(false);
  }

  function eliminar(i: number) {
    setObjeciones((prev) => prev.filter((_, idx) => idx !== i));
    setExito(false);
  }

  function agregar(clave: ClavePiso | null = null) {
    setObjeciones((prev) => [...prev, { objecion: "", respuesta: "", clave }]);
    setExito(false);
  }

  function cargarBase() {
    // No pisa lo que ya escribió: agrega sólo las que no tiene.
    setObjeciones((prev) => {
      if (prev.length === 0) return clonarBase();
      const yaEstan = new Set(
        prev.map((o) => o.objecion.trim().toLowerCase()),
      );
      const clavesPrevias = new Set(prev.map((o) => o.clave).filter(Boolean));
      const nuevas = clonarBase().filter(
        (o) =>
          !yaEstan.has(o.objecion.trim().toLowerCase()) &&
          (!o.clave || !clavesPrevias.has(o.clave)),
      );
      return [...prev, ...nuevas];
    });
    setExito(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    setExito(false);
    const r = await patchCuenta(cuenta.id, {
      playbook_objeciones: objeciones,
      playbook_activo: activo,
    });
    if ("error" in r) setError(r.error);
    else {
      onActualizada(r);
      setObjeciones(r.playbook_objeciones ?? []);
      setExito(true);
      setTimeout(() => setExito(false), 2500);
    }
    setGuardando(false);
  }

  return (
    <Tarjeta
      titulo="Playbook de objeciones"
      descripcion="Cómo cierra tu negocio. Escribís el enfoque para cada objeción y el agente lo dice con su tono. Sin esto, el modelo improvisa una respuesta comercial distinta en cada conversación."
    >
      <form onSubmit={guardar} className="flex flex-col gap-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => {
              setActivo(e.target.checked);
              setExito(false);
            }}
            className="mt-1 h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
          />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Usar el playbook en las respuestas
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Apagado, el agente sigue vendiendo con el catálogo y el
              conocimiento, pero contesta las objeciones a su criterio.
            </span>
          </span>
        </label>

        {faltan.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Te falta el piso: {faltan.map((c) => ETIQUETA_PISO[c]).join(" y ")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-200/80">
              Son las dos objeciones que no conviene dejar al criterio del
              modelo: un descuento o una garantía inventados los termina
              pagando el negocio. Cargalas para que el agente derive a una
              persona en vez de prometer.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {faltan.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const base = PLAYBOOK_BASE.find((o) => o.clave === c);
                    if (base) setObjeciones((prev) => [...prev, { ...base }]);
                  }}
                  className="rounded-lg border border-amber-500/40 px-2.5 py-1 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-500/15 dark:text-amber-200"
                >
                  Agregar &quot;{ETIQUETA_PISO[c]}&quot;
                </button>
              ))}
            </div>
          </div>
        )}

        {objeciones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500">
              Todavía no cargaste ninguna objeción.
            </p>
            <button
              type="button"
              onClick={cargarBase}
              className="mt-3 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Cargar las 8 base
            </button>
            <p className="mt-2 text-[11px] text-zinc-500">
              Sirven para cualquier rubro. Después las editás con tus palabras.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {objeciones.map((o, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {o.clave ? (
                      <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                        Piso · {ETIQUETA_PISO[o.clave]}
                      </span>
                    ) : (
                      `Objeción ${i + 1}`
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => eliminar(i)}
                    className="text-[11px] font-medium text-red-600 transition-colors hover:text-red-500 dark:text-red-400"
                  >
                    Quitar
                  </button>
                </div>
                <input
                  value={o.objecion}
                  onChange={(e) => actualizar(i, "objecion", e.target.value)}
                  placeholder="Cómo lo dice el cliente — ej: Está caro / No me alcanza"
                  maxLength={160}
                  className={inputClases()}
                />
                <textarea
                  value={o.respuesta}
                  onChange={(e) => actualizar(i, "respuesta", e.target.value)}
                  placeholder="Qué tiene que hacer el agente. El enfoque, no el texto literal."
                  rows={3}
                  maxLength={900}
                  className={`${textareaClases()} mt-2`}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => agregar()}
            className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
          >
            + Objeción
          </button>
          {objeciones.length > 0 && (
            <button
              type="button"
              onClick={cargarBase}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            >
              Completar con las base
            </button>
          )}
          <span className="text-[11px] text-zinc-500">
            {completas} de {objeciones.length} completas · piso{" "}
            {CLAVES_PISO.length - faltan.length}/{CLAVES_PISO.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {botonGuardar({ guardando })}
          <MensajeEstado exito={exito} error={error} />
        </div>
      </form>
    </Tarjeta>
  );
}
