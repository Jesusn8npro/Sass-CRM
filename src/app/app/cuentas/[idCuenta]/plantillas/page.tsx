"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type {
  ConversacionConPreview,
  RespuestaRapida,
} from "@/lib/baseDatos";

interface RespuestaPlantillas {
  respuestas: RespuestaRapida[];
}
interface RespuestaConvs {
  conversaciones: ConversacionConPreview[];
}

/**
 * Página /plantillas — gestión de mensajes plantilla y envío masivo.
 *
 * Reusa las "respuestas rápidas" como plantillas (mismo concepto:
 * mensaje pre-armado para reusar). Agrega arriba un panel de envío
 * masivo: elegís plantilla + contactos seleccionados → encolar.
 *
 * Anti-ban: el envío respeta el límite diario por cuenta (80) y el
 * horario humano (8-22h del server) que ya implementa el bot. Si te
 * pasás del límite, los mensajes quedan en cola y se envían después.
 */
export default function PaginaPlantillas() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [plantillas, setPlantillas] = useState<RespuestaRapida[]>([]);
  const [convs, setConvs] = useState<ConversacionConPreview[]>([]);
  const [cargando, setCargando] = useState(true);

  // Crear nueva
  const [atajo, setAtajo] = useState("");
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(false);

  // Envío masivo
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [plantillaParaEnvio, setPlantillaParaEnvio] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas`, {
          cache: "no-store",
        }),
        fetch(`/api/cuentas/${idCuenta}/conversaciones`, {
          cache: "no-store",
        }),
      ]);
      if (r1.ok) {
        const d = (await r1.json()) as RespuestaPlantillas;
        setPlantillas(d.respuestas);
      }
      if (r2.ok) {
        const d = (await r2.json()) as RespuestaConvs;
        setConvs(d.conversaciones);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCuenta]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!atajo.trim() || !texto.trim() || creando) return;
    setCreando(true);
    try {
      await fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atajo: atajo.trim(), texto: texto.trim() }),
      });
      setAtajo("");
      setTexto("");
      await cargar();
    } finally {
      setCreando(false);
    }
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar plantilla?")) return;
    await fetch(`/api/cuentas/${idCuenta}/respuestas-rapidas/${id}`, {
      method: "DELETE",
    });
    await cargar();
  }

  function toggle(id: string) {
    setSeleccionadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleTodas() {
    if (seleccionadas.size === convs.length) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(convs.map((c) => c.id)));
    }
  }

  async function enviarMasivo() {
    const plantilla = plantillas.find((p) => p.id === plantillaParaEnvio);
    if (!plantilla) {
      setResultadoEnvio("✗ Elegí una plantilla");
      return;
    }
    if (seleccionadas.size === 0) {
      setResultadoEnvio("✗ Elegí al menos un contacto");
      return;
    }
    if (
      !confirm(
        `Vas a encolar el envío de "${plantilla.atajo}" a ${seleccionadas.size} contacto${seleccionadas.size === 1 ? "" : "s"}.\n\nLos mensajes se mandan respetando límite diario (80/cuenta) y horario humano (8-22h). ¿Continuar?`,
      )
    ) {
      return;
    }
    setEnviando(true);
    setResultadoEnvio(null);
    let ok = 0;
    let err = 0;
    try {
      for (const idConv of seleccionadas) {
        const conv = convs.find((c) => c.id === idConv);
        if (!conv) continue;
        try {
          const res = await fetch(
            `/api/cuentas/${idCuenta}/seguimientos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversacion_id: idConv,
                contenido: plantilla.texto,
                programado_para: new Date(Date.now() + 60_000).toISOString(),
              }),
            },
          );
          if (res.ok) ok++;
          else err++;
        } catch {
          err++;
        }
      }
      setResultadoEnvio(
        `✓ ${ok} encolado${ok === 1 ? "" : "s"}${err > 0 ? `, ${err} fallaron` : ""}. Se envían en los próximos minutos respetando rate-limit.`,
      );
      setSeleccionadas(new Set());
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
          Marketing
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Plantillas</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">
          Mensajes pre-armados para reusar manualmente o mandar masivo a
          múltiples contactos. Respetan rate-limit anti-ban.
        </p>
      </header>

      {/* Envío masivo */}
      <section className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <h2 className="mb-3 text-sm font-semibold">Envío masivo</h2>
        {plantillas.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Creá al menos una plantilla abajo para poder usar el envío masivo.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Plantilla a enviar
              </label>
              <select
                value={plantillaParaEnvio}
                onChange={(e) => setPlantillaParaEnvio(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">— Elegí una —</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.atajo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-sm">
                <span className="font-semibold">{seleccionadas.size}</span>{" "}
                contacto{seleccionadas.size === 1 ? "" : "s"} seleccionado
                {seleccionadas.size === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={enviarMasivo}
                disabled={
                  enviando || !plantillaParaEnvio || seleccionadas.size === 0
                }
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
              >
                {enviando ? "Encolando…" : "Encolar envío"}
              </button>
            </div>
          </div>
        )}
        {resultadoEnvio && (
          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-900">
            {resultadoEnvio}
          </p>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Plantillas */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold">
            Mis plantillas ({plantillas.length})
          </h2>
          <form onSubmit={crear} className="mb-4 space-y-2">
            <input
              type="text"
              value={atajo}
              onChange={(e) => setAtajo(e.target.value)}
              placeholder="Atajo (ej: /precios, /horarios)"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Mensaje a enviar"
              rows={3}
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="submit"
              disabled={!atajo.trim() || !texto.trim() || creando}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              + Agregar plantilla
            </button>
          </form>
          {cargando ? (
            <p className="text-xs text-zinc-500">Cargando…</p>
          ) : plantillas.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No hay plantillas todavía. Creá la primera arriba.
            </p>
          ) : (
            <ul className="space-y-2">
              {plantillas.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {p.atajo}
                    </span>
                    <button
                      type="button"
                      onClick={() => borrar(p.id)}
                      className="text-[10px] text-zinc-400 hover:text-red-600"
                    >
                      Borrar
                    </button>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">
                    {p.texto}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Lista contactos para selección */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Contactos ({convs.length})
            </h2>
            <button
              type="button"
              onClick={toggleTodas}
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {seleccionadas.size === convs.length
                ? "Deseleccionar todos"
                : "Seleccionar todos"}
            </button>
          </div>
          {convs.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No hay conversaciones — todavía nadie escribió a este número.
            </p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {convs.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <input
                      type="checkbox"
                      checked={seleccionadas.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4"
                    />
                    <span className="truncate">
                      {c.nombre ?? `+${c.telefono}`}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-zinc-500">
                      +{c.telefono}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
