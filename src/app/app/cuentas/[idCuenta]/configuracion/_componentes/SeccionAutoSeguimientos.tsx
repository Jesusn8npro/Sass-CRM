"use client";

import { useEffect, useState } from "react";

interface PasoUI {
  minutos_despues: number;
  mensaje: string;
}

interface RespuestaApi {
  activo: boolean;
  pasos: PasoUI[];
}

const PRESETS_TIEMPO = [
  { label: "5 min", min: 5 },
  { label: "10 min", min: 10 },
  { label: "30 min", min: 30 },
  { label: "1 h", min: 60 },
  { label: "3 h", min: 180 },
  { label: "12 h", min: 720 },
  { label: "24 h", min: 1440 },
];

const MENSAJES_SUGERIDOS = [
  "Hola, ¿pudiste ver mi mensaje anterior? 🙂",
  "Te dejo saber que sigo por acá si tenés alguna duda.",
  "¿Te quedó alguna pregunta? Contame y te ayudo.",
];

/**
 * Sección de configuración de auto-seguimientos. El user define una
 * secuencia de "esperar X min y mandar este texto si el cliente no
 * respondió". Al cargar, lee el estado actual; al guardar, hace PUT
 * con la lista completa.
 */
export function SeccionAutoSeguimientos({ idCuenta }: { idCuenta: string }) {
  const [activo, setActivo] = useState(false);
  const [pasos, setPasos] = useState<PasoUI[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const r = await fetch(
          `/api/cuentas/${idCuenta}/auto-seguimientos`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const d = (await r.json()) as RespuestaApi;
        if (cancelado) return;
        setActivo(d.activo);
        setPasos(d.pasos);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [idCuenta]);

  function actualizarPaso(i: number, cambio: Partial<PasoUI>) {
    setPasos((prev) => prev.map((p, j) => (j === i ? { ...p, ...cambio } : p)));
  }

  function agregarPaso() {
    const ultimo = pasos[pasos.length - 1];
    const minSugerido = ultimo
      ? Math.min(ultimo.minutos_despues * 2, 1440)
      : 10;
    setPasos((prev) => [
      ...prev,
      {
        minutos_despues: minSugerido,
        mensaje: MENSAJES_SUGERIDOS[prev.length] ?? MENSAJES_SUGERIDOS[0]!,
      },
    ]);
  }

  function quitarPaso(i: number) {
    setPasos((prev) => prev.filter((_, j) => j !== i));
  }

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/auto-seguimientos`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo, pasos }),
        },
      );
      const data = (await r.json()) as { ok?: boolean; mensaje?: string };
      if (!r.ok || !data.ok) {
        setMensaje({ tipo: "error", texto: data.mensaje ?? "Error al guardar" });
      } else {
        setMensaje({ tipo: "ok", texto: "Guardado ✓" });
        setTimeout(() => setMensaje(null), 3000);
      }
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500">Cargando…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Recordatorios automáticos
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">
            Auto-seguimientos
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-zinc-500">
            Si un cliente deja de responder, el agente le manda recordatorios
            automáticos en los tiempos que vos definas. Cada paso se cuenta
            desde el último mensaje del bot. Si el cliente responde, el ciclo
            se reinicia.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {activo ? "Activado" : "Desactivado"}
          </span>
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-zinc-300 transition-colors checked:bg-emerald-500 dark:bg-zinc-700"
          />
        </label>
      </header>

      <div className="space-y-3">
        {pasos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-700">
            Sin pasos configurados. Click en &quot;Agregar paso&quot; para
            empezar.
          </p>
        ) : (
          pasos.map((p, i) => (
            <FilaPaso
              key={i}
              indice={i}
              paso={p}
              onChange={(c) => actualizarPaso(i, c)}
              onQuitar={() => quitarPaso(i)}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={agregarPaso}
          disabled={pasos.length >= 10}
          className="rounded-full border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"
        >
          + Agregar paso {pasos.length >= 10 && "(máx 10)"}
        </button>
        <div className="flex items-center gap-2">
          {mensaje && (
            <span
              className={`text-xs font-medium ${
                mensaje.tipo === "ok"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {mensaje.texto}
            </span>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-400 disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </section>
  );
}

function FilaPaso({
  indice,
  paso,
  onChange,
  onQuitar,
}: {
  indice: number;
  paso: PasoUI;
  onChange: (cambio: Partial<PasoUI>) => void;
  onQuitar: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
          {indice + 1}
        </span>
        <button
          type="button"
          onClick={onQuitar}
          className="text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400"
        >
          Quitar
        </button>
      </div>

      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Esperar
      </label>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {PRESETS_TIEMPO.map((t) => (
          <button
            key={t.min}
            type="button"
            onClick={() => onChange({ minutos_despues: t.min })}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              paso.minutos_despues === t.min
                ? "bg-emerald-500 text-white"
                : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={43200}
          value={paso.minutos_despues}
          onChange={(e) =>
            onChange({
              minutos_despues: Math.max(1, Number(e.target.value) || 1),
            })
          }
          className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          aria-label="Minutos personalizados"
        />
        <span className="text-[11px] text-zinc-500">min desde el último msg del bot</span>
      </div>

      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Mensaje a enviar
      </label>
      <textarea
        value={paso.mensaje}
        onChange={(e) => onChange({ mensaje: e.target.value })}
        rows={2}
        maxLength={2000}
        placeholder="Hola, ¿pudiste ver mi mensaje?"
        className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
    </div>
  );
}
