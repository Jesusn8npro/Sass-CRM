"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";

interface SuperAdmin {
  id: string;
  email: string;
  telefono_whatsapp: string;
  nombre: string | null;
  activo: boolean;
  ultimo_reporte_diario_en: string | null;
  creado_en: string;
}

export default function PaginaSuperAdmins() {
  const { exito, error: toastError } = useToast();
  const { confirmar } = useConfirm();

  const [items, setItems] = useState<SuperAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const [formEmail, setFormEmail] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formNombre, setFormNombre] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/super-admins", { cache: "no-store" });
      if (!res.ok) {
        toastError("No se pudo cargar la lista");
        return;
      }
      const j = (await res.json()) as { items: SuperAdmin[] };
      setItems(j.items);
    } finally {
      setCargando(false);
    }
  }, [toastError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditando(null);
    setFormEmail("");
    setFormTelefono("");
    setFormNombre("");
    setMostrarForm(true);
  }

  function abrirEditar(sa: SuperAdmin) {
    setEditando(sa.id);
    setFormEmail(sa.email);
    setFormTelefono(sa.telefono_whatsapp);
    setFormNombre(sa.nombre ?? "");
    setMostrarForm(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const url = editando
        ? `/api/admin/super-admins/${editando}`
        : "/api/admin/super-admins";
      const metodo = editando ? "PATCH" : "POST";
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formEmail,
          telefono_whatsapp: formTelefono,
          nombre: formNombre || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toastError(j.error ?? "Error al guardar");
        return;
      }
      exito(editando ? "Super-admin actualizado" : "Super-admin creado");
      setMostrarForm(false);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(sa: SuperAdmin) {
    const accion = sa.activo ? "Desactivar" : "Activar";
    const ok = await confirmar({
      titulo: `${accion} super-admin`,
      mensaje: sa.activo
        ? "Va a dejar de recibir reportes y no podrá ejecutar comandos vía WhatsApp."
        : "Va a recibir reportes diarios y podrá ejecutar comandos vía WhatsApp.",
      variante: sa.activo ? "peligro" : "neutro",
      textoConfirmar: accion,
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/super-admins/${sa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !sa.activo }),
    });
    if (res.ok) {
      exito(`${accion}do`);
      await cargar();
    } else {
      toastError("No se pudo actualizar");
    }
  }

  async function eliminar(sa: SuperAdmin) {
    const ok = await confirmar({
      titulo: `Eliminar a ${sa.email}`,
      mensaje:
        "Se elimina el super-admin permanentemente. Las acciones históricas de este admin se conservan en el log de auditoría.",
      variante: "peligro",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/super-admins/${sa.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      exito("Eliminado");
      await cargar();
    } else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toastError(j.error ?? "No se pudo eliminar");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
            // super-admins
          </p>
          <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
            Control total
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-white/55">
            Dueños/operadores del SaaS. Reciben reportes diarios por WhatsApp
            y pueden ejecutar comandos privilegiados desde su número
            registrado. Es distinto del rol de panel <code>admin_plataforma</code> en{" "}
            <code>/app/admin/usuarios</code>: ese da acceso al sitio web; este
            da acceso al canal WhatsApp del bot.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 dark:bg-white dark:text-black dark:hover:bg-emerald-300"
        >
          + Nuevo
        </button>
      </header>

      {mostrarForm && (
        <form
          onSubmit={guardar}
          className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]"
        >
          <p className="mb-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
            // {editando ? "editar" : "nuevo"}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
                Email
              </span>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="admin@dominio.com"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.06] dark:bg-black dark:text-white dark:focus:border-emerald-400/50"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
                Teléfono WhatsApp (E.164 sin +)
              </span>
              <input
                type="text"
                required
                value={formTelefono}
                onChange={(e) => setFormTelefono(e.target.value)}
                placeholder="573123790071"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.06] dark:bg-black dark:text-white dark:focus:border-emerald-400/50"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
                Nombre (opcional)
              </span>
              <input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Admin Global"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.06] dark:bg-black dark:text-white dark:focus:border-emerald-400/50"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-400 dark:border-white/[0.10] dark:text-white/80 dark:hover:border-white/30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:border-white/[0.06] dark:text-white/40">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Teléfono WhatsApp</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Último reporte</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-white/40">
                    Cargando…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-white/40">
                    No hay super-admins. Creá el primero arriba.
                  </td>
                </tr>
              ) : (
                items.map((sa) => (
                  <tr
                    key={sa.id}
                    className="border-t border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-white/[0.04] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 text-zinc-900 dark:text-white">{sa.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-white/80">
                      +{sa.telefono_whatsapp}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-white/70">
                      {sa.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs uppercase tracking-wider">
                      <span className={pillActivo(sa.activo)}>
                        {sa.activo ? "activo" : "inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500 dark:text-white/50">
                      {sa.ultimo_reporte_diario_en
                        ? new Date(sa.ultimo_reporte_diario_en).toLocaleString("es-AR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEditar(sa)}
                          className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium text-zinc-700 hover:border-zinc-400 dark:border-white/[0.10] dark:text-white/80 dark:hover:border-white/30"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActivo(sa)}
                          className={
                            sa.activo
                              ? "rounded-full border border-amber-500/40 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/[0.06] dark:text-amber-200 dark:hover:bg-amber-400/[0.12]"
                              : "rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.12]"
                          }
                        >
                          {sa.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void eliminar(sa)}
                          className="rounded-full border border-red-500/40 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/[0.06] dark:text-red-200 dark:hover:bg-red-400/[0.12]"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function pillActivo(activo: boolean): string {
  const base =
    "inline-flex rounded-full border px-2 py-0.5 text-[10px] tracking-wider";
  if (activo)
    return `${base} border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/[0.08] dark:text-emerald-200`;
  return `${base} border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/50`;
}
