import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import { listarCuentas, obtenerCuenta } from "@/lib/baseDatos";
import { SidebarPanel } from "@/components/SidebarPanel";

/**
 * Layout persistente para todas las páginas dentro de
 * `/app/cuentas/[idCuenta]/...`. Renderiza el sidebar global
 * con navegación contextual a la cuenta + selector si hay > 1.
 *
 * El sidebar NO se re-monta al navegar entre pages dentro de la misma
 * cuenta — lo que mantiene polling/state intacto.
 */
export default async function LayoutCuenta({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ idCuenta: string }>;
}) {
  const { idCuenta } = await params;
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/app");

  // Validar que la cuenta existe y pertenece al usuario.
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    redirect("/app");
  }

  // Lista de cuentas del usuario para el selector dropdown.
  const cuentas = await listarCuentas(auth.id);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <SidebarPanel idCuentaActual={idCuenta} cuentas={cuentas} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
