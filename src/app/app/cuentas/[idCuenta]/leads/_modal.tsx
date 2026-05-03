"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeadUI } from "./page";

interface Props {
  idCuenta: string;
  lead: LeadUI | null;
  onCerrar: () => void;
  onImportado: (conversacionId: string) => void;
}

/**
 * Modal con info completa del lead seleccionado + accion "Importar a
 * CRM" que crea conversacion + contactos. Si ya esta importado,
 * muestra link directo al chat.
 */
export function LeadDetalleModal({
  idCuenta,
  lead,
  onCerrar,
  onImportado,
}: Props) {
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC para cerrar
  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onCerrar]);

  // Reset al cambiar de lead
  useEffect(() => {
    setError(null);
  }, [lead?.id]);

  if (!lead) return null;

  async function importar() {
    if (importando || !lead) return;
    setImportando(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/cuentas/${idCuenta}/apify/leads/${lead.id}/importar`,
        { method: "POST" },
      );
      const data = (await r.json()) as {
        ok?: boolean;
        conversacion_id?: string;
        error?: string;
      };
      if (!r.ok || !data.ok || !data.conversacion_id) {
        setError(data.error ?? "No se pudo importar");
      } else {
        onImportado(data.conversacion_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-base font-bold text-white shadow-md">
              {lead.nombre.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Lead extraído
              </p>
              <h2 className="truncate text-lg font-bold tracking-tight">
                {lead.nombre}
              </h2>
              {lead.categoria && (
                <p className="text-xs text-zinc-500">{lead.categoria}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
            <CampoDetalle
              etiqueta="Teléfono"
              valor={lead.telefono ? `+${lead.telefono}` : null}
              accion={
                lead.telefono
                  ? {
                      texto: "WhatsApp",
                      href: `https://wa.me/${lead.telefono}`,
                      target: "_blank",
                    }
                  : undefined
              }
            />
            <CampoDetalle
              etiqueta="Email"
              valor={lead.email}
              accion={
                lead.email
                  ? { texto: "Enviar mail", href: `mailto:${lead.email}` }
                  : undefined
              }
            />
            <CampoDetalle
              etiqueta="Sitio web"
              valor={lead.sitio_web}
              accion={
                lead.sitio_web
                  ? { texto: "Visitar", href: lead.sitio_web, target: "_blank" }
                  : undefined
              }
            />
            <CampoDetalle etiqueta="Categoría" valor={lead.categoria} />
            <div className="sm:col-span-2">
              <CampoDetalle etiqueta="Dirección" valor={lead.direccion} />
            </div>
          </dl>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          {lead.importado && lead.conversacion_id ? (
            <Link
              href={`/app/cuentas/${idCuenta}/conversaciones?conv=${lead.conversacion_id}`}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-400"
            >
              ✓ Ya importado · Abrir chat →
            </Link>
          ) : (
            <button
              type="button"
              onClick={importar}
              disabled={importando}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-400 disabled:opacity-50"
            >
              {importando ? "Importando…" : "Importar a CRM →"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function CampoDetalle({
  etiqueta,
  valor,
  accion,
}: {
  etiqueta: string;
  valor: string | null;
  accion?: { texto: string; href: string; target?: string };
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 break-words text-sm">
        {valor ? (
          <span className="text-zinc-900 dark:text-zinc-100">{valor}</span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
        {valor && accion && (
          <a
            href={accion.href}
            target={accion.target}
            rel={accion.target === "_blank" ? "noreferrer" : undefined}
            className="ml-2 text-[11px] font-semibold text-emerald-700 underline dark:text-emerald-400"
          >
            {accion.texto} →
          </a>
        )}
      </dd>
    </div>
  );
}
