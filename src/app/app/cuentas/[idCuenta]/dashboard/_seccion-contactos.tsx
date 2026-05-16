"use client";

import { useCallback, useState } from "react";
import type { ContactoEmail, ContactoTelefono } from "@/lib/baseDatos";
import { usePollingVisible } from "@/components/usePollingVisible";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatearFecha } from "./_componentes";
import { EstadoVacio } from "@/components/ui";

type ContactoEmailExt = ContactoEmail & { nombre_contacto: string | null; telefono: string | null };
type ContactoTelefonoExt = ContactoTelefono & { nombre_contacto: string | null; telefono_conv: string | null };

export function SeccionContactosCapturados({ idCuenta }: { idCuenta: string }) {
  const [contactos, setContactos] = useState<ContactoEmailExt[]>([]);
  const [telefonos, setTelefonos] = useState<ContactoTelefonoExt[]>([]);
  const [llamandoId, setLlamandoId] = useState<string | null>(null);
  const toast = useToast();
  const { confirmar } = useConfirm();

  const cargar = useCallback(async () => {
    const [resEmails, resTels] = await Promise.all([
      fetch(`/api/cuentas/${idCuenta}/contactos-email`, { cache: "no-store" }),
      fetch(`/api/cuentas/${idCuenta}/contactos-telefono`, { cache: "no-store" }),
    ]);
    if (resEmails.ok) {
      const d = await resEmails.json() as { contactos: ContactoEmailExt[] };
      setContactos(d.contactos);
    }
    if (resTels.ok) {
      const d = await resTels.json() as { contactos: ContactoTelefonoExt[] };
      setTelefonos(d.contactos);
    }
  }, [idCuenta]);

  usePollingVisible(cargar, 60_000);

  async function llamarTelefono(idContacto: string, tel: string) {
    if (llamandoId !== null) return;
    const ok = await confirmar({ mensaje: `¿Llamar a +${tel}?` });
    if (!ok) return;
    setLlamandoId(idContacto);
    try {
      const res = await fetch(`/api/cuentas/${idCuenta}/llamadas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: tel }),
      });
      const data = await res.json().catch(() => ({})) as { llamada?: { vapi_call_id: string }; error?: string };
      if (res.ok && data.llamada) {
        toast.exito(`Llamada disparada (${data.llamada.vapi_call_id.slice(0, 10)}…)`);
      } else {
        toast.error("Error: " + (data.error ?? `HTTP ${res.status}`));
      }
    } catch (err) {
      toast.error("Error de red: " + (err instanceof Error ? err.message : "desconocido"));
    } finally {
      setLlamandoId(null);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Emails capturados ({contactos.length})
          </h2>
          {contactos.length > 0 && (
            <a href={`/api/cuentas/${idCuenta}/contactos-email?formato=csv`} className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400">
              Exportar CSV
            </a>
          )}
        </div>
        {contactos.length === 0 ? (
          <EstadoVacio tamano="sm" titulo="Sin emails capturados" descripcion="Cuando un cliente escriba su email en una conversación va a aparecer acá." />
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
                    <td className="px-2 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100">{c.email}</td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">{c.nombre_contacto ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{c.telefono ? `+${c.telefono}` : "—"}</td>
                    <td className="px-2 py-2 text-xs text-zinc-500">{formatearFecha(c.capturado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contactos.length > 50 && (
              <p className="mt-2 text-center text-[11px] text-zinc-500">Mostrando 50 de {contactos.length}. Exportá CSV para ver todos.</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Teléfonos capturados ({telefonos.length})
          </h2>
          {telefonos.length > 0 && (
            <a href={`/api/cuentas/${idCuenta}/contactos-telefono?formato=csv`} className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-400">
              Exportar CSV
            </a>
          )}
        </div>
        {telefonos.length === 0 ? (
          <EstadoVacio tamano="sm" titulo="Sin teléfonos capturados" descripcion="Cuando un cliente mencione otro número en la conversación lo capturamos acá. Excluye el propio número del cliente." />
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
                    <td className="px-2 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100">+{c.telefono}</td>
                    <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {c.nombre_contacto ? (
                        <>{c.nombre_contacto}<span className="ml-1 font-mono text-zinc-400">(de +{c.telefono_conv})</span></>
                      ) : c.telefono_conv ? (
                        <span className="font-mono text-zinc-400">+{c.telefono_conv}</span>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-500">{formatearFecha(c.capturado_en)}</td>
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
              <p className="mt-2 text-center text-[11px] text-zinc-500">Mostrando 50 de {telefonos.length}. Exportá CSV para ver todos.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
