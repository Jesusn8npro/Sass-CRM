import { listarLlamadasLanding, type LlamadaLanding } from "@/lib/db/llamadasLanding";

export const dynamic = "force-dynamic";

export default async function PaginaAdminLlamadasLanding() {
  const { filas, total } = await listarLlamadasLanding({ limite: 100 });

  const conTranscripcion = filas.filter((f) => f.transcripcion).length;
  const costototal = filas.reduce((acc, f) => acc + (f.costo_usd ?? 0), 0);
  const duracionTotal = filas.reduce((acc, f) => acc + (f.duracion_seg ?? 0), 0);
  const conNombre = filas.filter((f) => {
    const dn = f.datos_negocio as Record<string, unknown> | null;
    return dn?.nombre_contacto;
  }).length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // leads del widget voz
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Llamadas Landing
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-white/55">
          Todas las llamadas recibidas desde el widget de voz de la landing page. Datos capturados por el agente VAPI.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta etiqueta="// total llamadas" valor={String(total)} />
        <Tarjeta etiqueta="// con nombre" valor={String(conNombre)} acento="emerald" />
        <Tarjeta etiqueta="// con transcripción" valor={String(conTranscripcion)} acento="emerald" />
        <Tarjeta etiqueta="// costo total" valor={`$${costototal.toFixed(3)}`} acento="amber" />
        <Tarjeta etiqueta="// duración total" valor={formatDuracion(duracionTotal)} />
        <Tarjeta
          etiqueta="// duración media"
          valor={filas.length > 0 ? formatDuracion(Math.round(duracionTotal / filas.length)) : "—"}
        />
      </section>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Interés</th>
              <th className="px-4 py-3">Reunión</th>
              <th className="px-4 py-3 text-right">Duración</th>
              <th className="px-4 py-3 text-right">Costo</th>
              <th className="px-4 py-3">Resumen / Objeción</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400 dark:text-white/35">
                  sin llamadas registradas
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <FilaLlamada key={f.id} llamada={f} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaLlamada({ llamada: f }: { llamada: LlamadaLanding }) {
  const dn = (f.datos_negocio ?? {}) as Record<string, unknown>;
  const nombre = typeof dn.nombre_contacto === "string" ? dn.nombre_contacto : null;
  const email = typeof dn.email === "string" ? dn.email : null;
  const interes = typeof dn.nivel_interes === "string" ? dn.nivel_interes : null;
  const reunion = dn.reunion_agendada === true;
  const objecion = typeof dn.objecion_principal === "string" ? dn.objecion_principal : null;
  const proximoPaso = typeof dn.proximo_paso === "string" ? dn.proximo_paso : null;

  const resumenCorto = f.resumen ? f.resumen.slice(0, 120) + (f.resumen.length > 120 ? "…" : "") : null;
  const textoResumen = resumenCorto ?? objecion ?? proximoPaso ?? "—";

  return (
    <>
      <tr className="border-t border-zinc-100 dark:border-white/[0.04]">
        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50 whitespace-nowrap">
          {new Date(f.creado_en).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </td>
        <td className="px-4 py-3 text-zinc-900 dark:text-white font-medium">
          {nombre ?? <span className="text-zinc-400 dark:text-white/30 font-normal italic">sin nombre</span>}
        </td>
        <td className="px-4 py-3 font-mono text-[11px] text-zinc-600 dark:text-white/70">
          {email ?? <span className="text-zinc-400 dark:text-white/30 italic">—</span>}
        </td>
        <td className="px-4 py-3">
          {interes ? <PillInteres nivel={interes} /> : <span className="text-zinc-400 dark:text-white/30 font-mono text-[10px]">—</span>}
        </td>
        <td className="px-4 py-3">
          {reunion ? (
            <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-300">
              ✓ agendada
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-white/30 font-mono text-[10px]">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-mono text-[11px] text-zinc-600 dark:text-white/70 whitespace-nowrap">
          {f.duracion_seg != null ? formatDuracion(f.duracion_seg) : "—"}
        </td>
        <td className="px-4 py-3 text-right font-mono text-[11px] text-zinc-600 dark:text-white/70 whitespace-nowrap">
          {f.costo_usd != null ? `$${f.costo_usd.toFixed(4)}` : "—"}
        </td>
        <td className="px-4 py-3 max-w-xs">
          <p className="text-[12px] text-zinc-600 dark:text-white/60 leading-snug line-clamp-2">
            {textoResumen}
          </p>
        </td>
      </tr>
      {/* Fila expandida si hay transcripción */}
      {f.transcripcion && (
        <tr className="border-t border-zinc-50 dark:border-white/[0.02]">
          <td colSpan={8} className="px-4 pb-4 pt-1">
            <details className="group">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                ver transcripción completa ▸
              </summary>
              <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-zinc-100 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-700 dark:border-white/[0.04] dark:bg-white/[0.02] dark:text-white/60">
                {f.transcripcion}
              </pre>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}

function PillInteres({ nivel }: { nivel: string }) {
  const map: Record<string, string> = {
    alto: "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-300",
    medio: "border-amber-500/40 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-300",
    bajo: "border-zinc-300/60 bg-zinc-50 text-zinc-600 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/50",
    sin_interes: "border-red-500/40 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/[0.08] dark:text-red-300",
  };
  const cls = map[nivel] ?? map.bajo;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider ${cls}`}>
      {nivel.replace("_", " ")}
    </span>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  acento,
}: {
  etiqueta: string;
  valor: string;
  acento?: "emerald" | "amber";
}) {
  const color =
    acento === "emerald"
      ? "text-emerald-600 dark:text-emerald-300"
      : acento === "amber"
      ? "text-amber-600 dark:text-amber-300"
      : "text-zinc-900 dark:text-white";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-white/40">
        {etiqueta}
      </p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${color}`}>{valor}</p>
    </div>
  );
}

function formatDuracion(seg: number): string {
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
