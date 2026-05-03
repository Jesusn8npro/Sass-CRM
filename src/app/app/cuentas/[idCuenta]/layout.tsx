import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/lib/auth/sesion";
import { listarCuentas, obtenerCuenta } from "@/lib/baseDatos";
import { LayoutShellMovil } from "@/components/LayoutShellMovil";

/**
 * Layout persistente para todas las páginas dentro de
 * `/app/cuentas/[idCuenta]/...`. Renderiza el shell responsive con
 * sidebar (drawer en mobile, estático en desktop ≥lg).
 *
 * El shell NO se re-monta al navegar entre pages — preserva polling/state.
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
    <LayoutShellMovil idCuenta={idCuenta} cuentas={cuentas}>
      {children}
    </LayoutShellMovil>
  );
}
