"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type {
  ConversacionConPreview,
  ContactoEmailConTelefono,
  ContactoTelefonoConContexto,
} from "@/lib/baseDatos";

interface RespuestaConvs {
  conversaciones: ConversacionConPreview[];
}
interface RespuestaEmails {
  contactos: ContactoEmailConTelefono[];
}
interface RespuestaTels {
  contactos: ContactoTelefonoConContexto[];
}

/**
 * Página /clientes — vista CRM de contactos.
 *
 * Combina conversaciones (lo que vino por WhatsApp) + emails y
 * teléfonos capturados en una sola tabla. Filtros por modo / etapa
 * + exportar CSV.
 */
export default function PaginaClientes() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [convs, setConvs] = useState<ConversacionConPreview[]>([]);
  const [emails, setEmails] = useState<ContactoEmailConTelefono[]>([]);
  const [tels, setTels] = useState<ContactoTelefonoConContexto[]>([]);
  const [filtro, setFiltro] = useState("");
  const [modoFiltro, setModoFiltro] = useState<"todos" | "IA" | "HUMANO">(
    "todos",
  );
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`/api/cuentas/${idCuenta}/conversaciones`, {
            cache: "no-store",
          }),
          fetch(`/api/cuentas/${idCuenta}/contactos-email`, {
            cache: "no-store",
          }),
          fetch(`/api/cuentas/${idCuenta}/contactos-telefono`, {
            cache: "no-store",
          }),
        ]);
        if (cancelado) return;
        if (r1.ok) {
          const d = (await r1.json()) as RespuestaConvs;
          setConvs(d.conversaciones);
        }
        if (r2.ok) {
          const d = (await r2.json()) as RespuestaEmails;
          setEmails(d.contactos);
        }
        if (r3.ok) {
          const d = (await r3.json()) as RespuestaTels;
          setTels(d.contactos);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [idCuenta]);

  // Combinar: cada conversación es un cliente. Le agregamos email/tel
  // capturados para esa misma conv.
  const filas = useMemo(() => {
    const mapaEmail = new Map<string, string>();
    for (const e of emails) {
      if (e.conversacion_id && !mapaEmail.has(e.conversacion_id)) {
        mapaEmail.set(e.conversacion_id, e.email);
      }
    }
    const mapaTelExtra = new Map<string, string>();
    for (const t of tels) {
      if (t.conversacion_id && !mapaTelExtra.has(t.conversacion_id)) {
        mapaTelExtra.set(t.conversacion_id, t.telefono);
      }
    }
    return convs.map((c) => ({
      id: c.id,
      nombre: c.nombre ?? `+${c.telefono}`,
      telefono: `+${c.telefono}`,
      email: mapaEmail.get(c.id) ?? null,
      telefonoExtra: mapaTelExtra.get(c.id) ?? null,
      modo: c.modo,
      necesitaHumano: c.necesita_humano,
      etiquetas: c.etiquetas,
      ultimoMensaje: c.ultimo_mensaje_en,
      preview: c.vista_previa_ultimo_mensaje,
    }));
  }, [convs, emails, tels]);

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (modoFiltro !== "todos" && f.modo !== modoFiltro) return false;
      if (filtro) {
        const q = filtro.toLowerCase();
        return (
          f.nombre.toLowerCase().includes(q) ||
          f.telefono.includes(q) ||
          (f.email?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [filas, modoFiltro, filtro]);

  function exportarCSV() {
    const filas = [
      ["Nombre", "Telefono", "Email", "Modo", "Necesita_humano", "Ultimo_mensaje"],
      ...filtradas.map((f) => [
        f.nombre,
        f.telefono,
        f.email ?? "",
        f.modo,
        f.necesitaHumano ? "si" : "no",
        f.ultimoMensaje ?? "",
      ]),
    ];
    const csv = filas
      .map((r) => r.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${idCuenta.slice(0, 8)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            CRM
          </p>
          <h1 className="text-lg font-bold tracking-tight">Clientes</h1>
          <p className="text-xs text-zinc-500">
            {filtradas.length} de {filas.length} contacto
            {filas.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar nombre, teléfono o email…"
            className="w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-xs focus:border-emerald-500 focus:outline-none md:w-64 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            value={modoFiltro}
            onChange={(e) =>
              setModoFiltro(e.target.value as "todos" | "IA" | "HUMANO")
            }
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="todos">Todos los modos</option>
            <option value="IA">Solo IA</option>
            <option value="HUMANO">Solo humano</option>
          </select>
          <button
            type="button"
            onClick={exportarCSV}
            disabled={filtradas.length === 0}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            ↓ Exportar CSV
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {cargando ? (
          <p className="text-center text-sm text-zinc-500">Cargando…</p>
        ) : filas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">Aún no hay clientes</p>
            <p className="mt-1 text-xs text-zinc-500">
              Cuando alguien escriba a tu WhatsApp, aparecerá acá automáticamente.
            </p>
          </div>
        ) : filtradas.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            Ningún cliente matchea los filtros.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800">
                  <th className="px-4 py-2 font-semibold">Cliente</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Modo</th>
                  <th className="px-4 py-2 font-semibold">Etiquetas</th>
                  <th className="px-4 py-2 font-semibold">Último mensaje</th>
                  <th className="px-4 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{f.nombre}</p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {f.telefono}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {f.email ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          f.modo === "IA"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {f.modo}
                      </span>
                      {f.necesitaHumano && (
                        <span className="ml-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                          Atender
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {f.etiquetas.length === 0 ? (
                          <span className="text-zinc-400">—</span>
                        ) : (
                          f.etiquetas.map((et) => (
                            <span
                              key={et.id}
                              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] dark:bg-zinc-800"
                            >
                              {et.nombre}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {f.preview ? (
                        <span className="line-clamp-1">{f.preview}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/cuentas/${idCuenta}/conversaciones?conv=${f.id}`}
                        className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] hover:border-emerald-500/40 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-700 dark:hover:bg-emerald-900/20"
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
