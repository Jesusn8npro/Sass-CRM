import { SkeletonLineas, SkeletonTarjetaKpi } from "@/components/ui";

export default function Cargando() {
  return (
    <div className="min-h-screen bg-superficie-suave p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <SkeletonLineas filas={1} />
        </div>
        {/* Cabecera de semana — 7 columnas */}
        <div className="grid grid-cols-7 gap-2">
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
          <SkeletonTarjetaKpi />
        </div>
        {/* Cuerpo de citas */}
        <SkeletonLineas filas={10} />
      </div>
    </div>
  );
}
