import { SkeletonLineas } from "@/components/ui";

export default function Cargando() {
  return (
    <div className="min-h-screen bg-superficie-suave p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <SkeletonLineas filas={1} />
        </div>
        {/* Artículos en grilla */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <SkeletonLineas filas={3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
