"use client";

/**
 * Secciones del dashboard que dependen de las métricas + datos cargados.
 * Vive separado de page.tsx para mantener cada archivo bajo 400 líneas.
 */

import Link from "next/link";
import type {
  ContactoEmail,
  ContactoTelefono,
  MetricasCuenta,
} from "@/lib/baseDatos";
import { Kpi, formatearDia, formatearFecha } from "./_componentes";

const CLASE_COLOR_BARRA: Record<string, string> = {
  zinc: "bg-zinc-400",
  rojo: "bg-red-500",
  ambar: "bg-amber-500",
  amarillo: "bg-yellow-500",
  esmeralda: "bg-emerald-500",
  azul: "bg-blue-500",
  violeta: "bg-violet-500",
  rosa: "bg-pink-500",
};

type ContactoEmailExt = ContactoEmail & {
  nombre_contacto: string | null;
  telefono: string | null;
};
type ContactoTelefonoExt = ContactoTelefono & {
  nombre_contacto: string | null;
  telefono_conv: string | null;
};

export function SeccionVolumenYTops({
  metricas,
  idCuenta,
  maxBarra,
}: {
  metricas: MetricasCuenta;
  idCuenta: string;
  maxBarra: number;
}) {
  return (
    <>
      {/* Volumen por día */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Mensajes por día
          </h2>
          <p className="text-[11px] text-zinc-500">últimos 7 días</p>
        </div>
        {metricas.mensajes_por_dia.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Sin actividad en los últimos 7 días.
          </p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {metricas.mensajes_por_dia.map((d) => {
              const altura = (d.count / maxBarra) * 100;
              return (
                <div
                  key={d.dia}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-emerald-500 transition-all"
                      style={{ height: `${altura}%` }}
                      title={`${d.count} mensajes`}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    {formatearDia(d.dia)}
                  </p>
                  <p className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
                    {d.count}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Productos top: los más preguntados por clientes */}
      {metricas.productos_top.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Productos más preguntados
            </h2>
            <Link
              href={`/app/cuentas/${idCuenta}/productos`}
              className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
            >
              Ver todos →
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {metricas.productos_top.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/cuentas/${idCuenta}/productos/${p.id}/interesados`}
                    className="truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {p.nombre}
                  </Link>
                  <p className="text-[11px] text-zinc-500">
                    {p.precio != null
                      ? `${p.precio.toLocaleString("es-CO")} ${p.moneda}`
                      : "consultar"}
                    {p.stock != null &&
                      (p.stock > 0
                        ? ` · stock ${p.stock}`
                        : " · SIN STOCK")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {p.conversaciones_interesadas}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    interesado{p.conversaciones_interesadas === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline overview */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Pipeline
            </h2>
            <Link
              href={`/app/cuentas/${idCuenta}/pipeline`}
              className="text-[11px] text-emerald-700 underline dark:text-emerald-400"
            >
              Ver Kanban →
            </Link>
          </div>
          {metricas.por_etapa.length === 0 ? (
            <p className="text-xs text-zinc-500">Sin etapas creadas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {metricas.por_etapa.map((e) => (
                <li key={e.etapa_id ?? "sin"} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      CLASE_COLOR_BARRA[e.color] ?? CLASE_COLOR_BARRA.zinc
                    }`}
                  />
                  <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {e.nombre}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {e.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Etiquetas */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Etiquetas
            </h2>
          </div>
          {metricas.por_etiqueta.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Sin etiquetas. Creá algunas en Ajustes.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {metricas.por_etiqueta.map((e) => (
                <li key={e.etiqueta_id} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      CLASE_COLOR_BARRA[e.color] ?? CLASE_COLOR_BARRA.zinc
                    }`}
                  />
                  <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {e.nombre}
                  </span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {e.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Actividad de mensajes */}
      <section className="grid gap-3 md:grid-cols-3">
        <Kpi
          titulo="Mensajes recibidos"
          valor={metricas.mensajes_recibidos}
          detalle="Entrantes del cliente"
        />
        <Kpi
          titulo="Respondidos por IA"
          valor={metricas.mensajes_enviados_bot}
          detalle="Auto-generados"
        />
        <Kpi
          titulo="Respondidos por humano"
          valor={metricas.mensajes_enviados_humano}
          detalle="Desde el panel"
        />
      </section>
    </>
  );
}

export function SeccionContactosCapturados({
  contactos,
  telefonos,
  idCuenta,
  llamarTelefono,
  llamandoId,
}: {
  contactos: ContactoEmailExt[];
  telefonos: ContactoTelefonoExt[];
  idCuenta: string;
  llamarTelefono: (id: string, telefono: string) => void;
  llamandoId: string | null;
}) {
  return (
    <>
      {/* Contactos email */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Emails capturados ({contactos.length})
          </h2>
          {contactos.length > 0 && (
            <a
              href={`/api/cuentas/${idCuenta}/contactos-email?formato=csv`}
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400"
            >
              Exportar CSV
            </a>
          )}
        </div>
        {contactos.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Aún no se capturó ningún email. Cuando un cliente escriba su email
            en una conversación, aparece acá.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                  <th className="px-2 py-2 font-semibold">Email</th>
                  <th className="px-2 py-2 font-semibold">Contacto</th>
                  <th className="px-2 py-2 font-semibold">Teléfono</th>
                  <th className="px-2 py-2 font-semibold">Capturado</th>
                </tr>
              </thead>
              <tbody>
                {contactos.slice(0, 50).map((c) => (
                  <tr key={c.id} className="border-b border-zinc-50 dark:border-zinc-800/60">
                    <td className="px-2 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {c.email}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {c.nombre_contacto ?? "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {c.telefono ? `+${c.telefono}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {formatearFecha(c.capturado_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contactos.length > 50 && (
              <p className="mt-2 text-center text-[11px] text-zinc-500">
                Mostrando 50 de {contactos.length}. Exportá CSV para ver todos.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Teléfonos capturados */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Teléfonos capturados ({telefonos.length})
          </h2>
          {telefonos.length > 0 && (
            <a
              href={`/api/cuentas/${idCuenta}/contactos-telefono?formato=csv`}
              className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400"
            >
              Exportar CSV
            </a>
          )}
        </div>
        {telefonos.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Cuando un cliente mencione otro número en una conversación
            (ej: &quot;llamame al ...&quot;) lo capturamos acá. Excluimos el
            propio teléfono del cliente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                  <th className="px-2 py-2 font-semibold">Teléfono</th>
                  <th className="px-2 py-2 font-semibold">Contexto</th>
                  <th className="px-2 py-2 font-semibold">Capturado</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {telefonos.slice(0, 50).map((c) => (
                  <tr key={c.id} className="border-b border-zinc-50 dark:border-zinc-800/60">
                    <td className="px-2 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      +{c.telefono}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {c.nombre_contacto ? (
                        <>
                          {c.nombre_contacto}
                          <span className="ml-1 font-mono text-zinc-400">
                            (de +{c.telefono_conv})
                          </span>
                        </>
                      ) : c.telefono_conv ? (
                        <span className="font-mono text-zinc-400">
                          +{c.telefono_conv}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {formatearFecha(c.capturado_en)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => llamarTelefono(c.id, c.telefono)}
                        disabled={llamandoId === c.id}
                        className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                      >
                        {llamandoId === c.id ? "..." : "📞 Llamar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {telefonos.length > 50 && (
              <p className="mt-2 text-center text-[11px] text-zinc-500">
                Mostrando 50 de {telefonos.length}. Exportá CSV para ver todos.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}

