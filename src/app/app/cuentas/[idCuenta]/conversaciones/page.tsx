import { Suspense } from "react";
import { PanelConversaciones } from "@/components/PanelConversaciones";

interface Props {
  params: Promise<{ idCuenta: string }>;
}

export default async function PaginaConversaciones({ params }: Props) {
  const { idCuenta } = await params;
  return (
    <Suspense fallback={null}>
      <PanelConversaciones idCuenta={idCuenta} />
    </Suspense>
  );
}
