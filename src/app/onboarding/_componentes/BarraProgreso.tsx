/**
 * Barra de progreso del wizard. 4 segments — emerald si activo, gris
 * si pendiente. Texto "Paso N de 4" debajo. Sticky por encima del
 * contenido (encajada arriba contra la barra del layout).
 */
export function BarraProgreso({ pasoActual }: { pasoActual: 1 | 2 | 3 | 4 }) {
  return (
    <div className="sticky top-[57px] z-30 border-b border-white/[0.06] bg-black/80 backdrop-blur">
      <div className="mx-auto max-w-3xl px-5 py-4 sm:px-6">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => {
            const activo = n <= pasoActual;
            return (
              <div
                key={n}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  activo ? "bg-emerald-400" : "bg-white/10"
                }`}
                aria-current={n === pasoActual ? "step" : undefined}
              />
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Paso {pasoActual} de 4
        </p>
      </div>
    </div>
  );
}
