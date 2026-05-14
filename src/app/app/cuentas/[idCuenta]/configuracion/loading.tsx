import { SkeletonLineas } from "@/components/ui";

export default function Cargando() {
  return (
    <div className="min-h-screen bg-superficie-suave p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <SkeletonLineas filas={1} />
        </div>
        {/* Sección 1 */}
        <div className="space-y-3 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <SkeletonLineas filas={4} />
        </div>
        {/* Sección 2 */}
        <div className="space-y-3 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <SkeletonLineas filas={4} />
        </div>
        {/* Sección 3 */}
        <div className="space-y-3 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <SkeletonLineas filas={3} />
        </div>
      </div>
    </div>
  );
}
