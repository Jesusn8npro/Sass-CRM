import { db } from "@/lib/db/cliente";
import { obtenerSesionSuperAdmin } from "@/lib/admin/sesion";
import { listarAccionesAdmin } from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface FilaEvento {
  id: string;
  nivel: string | null;
  categoria: string | null;
  mensaje: string | null;
  payload: Record<string, unknown> | null;
  creado_en: string;
}

async function listarEventosLog(): Promise<FilaEvento[]> {
  const { data, error } = await db()
    .from("eventos_log")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[admin/logs] error:", error);
    return [];
  }
  return (data ?? []) as FilaEvento[];
}

export default async function PaginaLogs() {
  const sesion = await obtenerSesionSuperAdmin();
  if (!sesion) {
    // El layout ya redirige, pero TS no lo sabe — guard para satisfacer types
    return null;
  }

  const [eventos, acciones] = await Promise.all([
    listarEventosLog(),
    listarAccionesAdmin(sesion.superAdmin.id, 50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs</h2>
        <p className="text-sm text-zinc-500">
          Audit trail · últimos 100 eventos del bot + tus últimas 50 acciones
        </p>
      </div>

      <section>
        <h3 className="font-semibold mb-2">Mis acciones (super-admin)</h3>
        <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Origen</th>
                <th className="px-4 py-2 font-medium">Acción</th>
                <th className="px-4 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {acciones.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2 text-xs">
                    {new Date(a.creado_en).toLocaleString("es")}
                  </td>
                  <td className="px-4 py-2 capitalize">{a.origen}</td>
                  <td className="px-4 py-2 font-mono text-xs">{a.accion}</td>
                  <td className="px-4 py-2 text-xs text-rose-600">
                    {a.error ? a.error.slice(0, 80) : "—"}
                  </td>
                </tr>
              ))}
              {acciones.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    Sin acciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Eventos del bot</h3>
        <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Nivel</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {new Date(e.creado_en).toLocaleString("es")}
                  </td>
                  <td className="px-4 py-2 text-xs uppercase">
                    {e.nivel ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">{e.categoria ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {(e.mensaje ?? "").slice(0, 140)}
                  </td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    No hay eventos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
