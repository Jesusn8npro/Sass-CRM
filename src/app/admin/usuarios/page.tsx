import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";

interface FilaUsuario {
  id: string;
  email: string;
  nombre: string | null;
  plan: string | null;
  creado_en: string;
  cantidad_cuentas: number;
}

async function listarUsuariosConCuentas(): Promise<FilaUsuario[]> {
  const { data, error } = await db()
    .from("usuarios")
    .select("id, email, nombre, plan, creado_en")
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[admin/usuarios] error listando:", error);
    return [];
  }
  const usuarios = (data ?? []) as Array<{
    id: string;
    email: string;
    nombre: string | null;
    plan: string | null;
    creado_en: string;
  }>;

  // Count de cuentas por usuario
  const { data: cuentasData } = await db()
    .from("cuentas")
    .select("usuario_id")
    .eq("esta_archivada", false);
  const conteo = new Map<string, number>();
  for (const c of (cuentasData ?? []) as Array<{ usuario_id: string }>) {
    conteo.set(c.usuario_id, (conteo.get(c.usuario_id) ?? 0) + 1);
  }

  return usuarios.map((u) => ({
    ...u,
    cantidad_cuentas: conteo.get(u.id) ?? 0,
  }));
}

export default async function PaginaUsuarios() {
  const filas = await listarUsuariosConCuentas();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <p className="text-sm text-zinc-500">
          {filas.length} usuarios registrados
        </p>
      </div>
      <div className="rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium text-center">Cuentas</th>
              <th className="px-4 py-2 font-medium">Registrado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2">{u.nombre ?? "—"}</td>
                <td className="px-4 py-2 capitalize">{u.plan ?? "free"}</td>
                <td className="px-4 py-2 text-center">{u.cantidad_cuentas}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {new Date(u.creado_en).toLocaleDateString("es")}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No hay usuarios todavía
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
