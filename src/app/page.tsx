import { Suspense } from "react";
import { PuertaConexion } from "@/components/PuertaConexion";

// useSearchParams (deep-link ?cuenta=X&conv=Y desde Pipeline) obliga a
// envolver en Suspense para que el build de Next pueda renderizarla.
export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <PuertaConexion />
    </Suspense>
  );
}
