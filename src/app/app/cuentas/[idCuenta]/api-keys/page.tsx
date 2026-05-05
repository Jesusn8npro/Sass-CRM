"use client";

/**
 * Página de gestión de API Keys.
 *
 * Renderiza el panel de gestión + documentación inline. La auth de la
 * página la maneja el layout de `/app/cuentas/[idCuenta]` — acá solo
 * leemos el `idCuenta` del path.
 */
import { useParams } from "next/navigation";
import { PanelApiKeys } from "@/components/PanelApiKeys";
import { Documentacion } from "./_componentes/Documentacion";

export default function PaginaApiKeys() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <PanelApiKeys idCuenta={idCuenta} />
        <Documentacion />
      </div>
    </div>
  );
}
