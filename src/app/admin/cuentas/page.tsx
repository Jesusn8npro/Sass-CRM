import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";

interface FilaCuenta {
  id: string;
  etiqueta: string;
  telefono: string | null;
  estado: string;
  esta_activa: boolean;
  ultimo_heartbeat: number | null;
  usuario_email: string;
  creada_en: string;
}

async function listarTodasLasCuentas(): Promise<FilaCuenta[]> {
  const { data, error } = await db()
    .from("cuentas")
    .select(
      "id, etiqueta, telefono, estado, esta_activa, ultimo_heartbeat, creada_en, usuario_id, usuarios:usuario_id(email)",
    )
    .eq("esta_archivada", false)
    .order("creada_en", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[admin/cuentas] error:", error);
    return [];
  }
  const arr = (data ?? []) as Array<{
    id: string;
    etiqueta: string;
    telefono: string | null;
    estado: string;
    esta_activa: boolean;
    ultimo_heartbeat: number | null;
    creada_en: string;
    usuarios: { email: string } | { email: string }[] | null;
  }>;
  return arr.map((c) => {
    const u = Array.isArray(c.usuarios) ? c.usuarios[0] : c.usuarios;
    return {
      id: c.id,
      etiqueta: c.etiqueta,
      telefono: c.telefono,
      estado: c.estado,
      esta_activa: c.esta_activa,
      ultimo_heartbeat: c.ultimo_heartbeat,
      usuario_email: u?.email ?? "?",
      creada_en: c.creada_en,
    };
  });
}

function clasificarSalud(
  c: FilaCuenta,
): { label: string; color: string } {
  if (!c.esta_activa) return { label: "Pausada", color: "text-zinc-500" };
  const ahora = Math.floor(Date.now() / 1000);
  const heartbeat = c.ultimo_heartbeat ?? 0;
  const segSinHeartbeat = ahora - heartbeat;
  if (segSinHeartbeat < 60)
    return { label: "🟢 Conectada", color: "text-emerald-600" };
  if (segSinHeartbeat < 30 * 60)
    return { label: "🟡 Reconectando", color: "text-amber-600" };
  return { label: "🔴 Caída", color: "text-rose-600" };
}

export default async function PaginaCuentas() {
  const filas = await listarTodasLasCuentas();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Cuentas WhatsApp</h2>
        <p className="text-sm text-zinc-500">
          {filas.length} cuentas no archivadas
        </p>
      </div>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Cuenta</th>
              <th className="px-4 py-2 font-medium">Teléfono</th>
              <th className="px-4 py-2 font-medium">Dueño</th>
              <th className="px-4 py-2 font-medium">Salud</th>
              <th className="px-4 py-2 font-medium">Estado WA</th>
              <th className="px-4 py-2 font-medium">Creada</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((c) => {
              const salud = clasificarSalud(c);
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{c.etiqueta}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {c.telefono ? `+${c.telefono}` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {c.usuario_email}
                  </td>
                  <td className={`px-4 py-2 font-medium ${salud.color}`}>
                    {salud.label}
                  </td>
                  <td className="px-4 py-2 text-xs capitalize">{c.estado}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {new Date(c.creada_en).toLocaleDateString("es")}
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No hay cuentas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
