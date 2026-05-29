"use client";

/**
 * Página para conectar el Supabase del negocio del cliente.
 *
 * La auth la maneja el layout de `/app/cuentas/[idCuenta]` — acá solo
 * leemos el `idCuenta` del path y renderizamos el panel.
 */
import { useParams } from "next/navigation";
import { PanelSupabaseExterno } from "@/components/PanelSupabaseExterno";

export default function PaginaSupabaseExterno() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <PanelSupabaseExterno idCuenta={idCuenta} />
      </div>
    </div>
  );
}
