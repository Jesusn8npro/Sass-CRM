import { SkeletonLineas, SkeletonTarjetaKpi } from "@/components/ui";

export default function Cargando() {
  return (
    <div className="min-h-screen bg-superficie-suave p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <SkeletonLineas filas={1} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
        </div>
        <SkeletonLineas filas={6} />
      </div>
    </div>
  );
}
