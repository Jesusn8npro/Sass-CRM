import { Suspense } from "react";
import { PuertaConexion } from "@/components/PuertaConexion";

/**
 * Panel principal de la aplicación.
 *
 * Esta ruta está protegida por el middleware: si no hay sesión,
 * redirige a /login. Una vez logueado, el usuario ve sus cuentas
 * de WhatsApp y todo el CRM.
 *
 * useSearchParams (deep-link ?cuenta=X&conv=Y desde Pipeline) obliga a
 * envolver en Suspense para que el build de Next pueda renderizarla.
 */
export default function PaginaPanel() {
  return (
    <Suspense fallback={null}>
      <PuertaConexion />
    </Suspense>
  );
}
