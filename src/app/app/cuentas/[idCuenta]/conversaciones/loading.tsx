import { SkeletonLineas } from "@/components/ui";

export default function Cargando() {
  return (
    <div className="flex min-h-screen bg-superficie-suave">
      {/* Panel izquierdo — lista de conversaciones */}
      <div className="w-full max-w-xs shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-4 space-y-2">
          <SkeletonLineas filas={1} />
        </div>
        <div className="space-y-3">
          <SkeletonLineas filas={8} />
        </div>
      </div>
      {/* Panel derecho — chat vacío */}
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 space-y-2">
          <SkeletonLineas filas={1} />
        </div>
        <div className="flex-1 space-y-4">
          <SkeletonLineas filas={10} />
        </div>
      </div>
    </div>
  );
}
