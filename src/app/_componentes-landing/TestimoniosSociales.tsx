// ============================================================
// TESTIMONIOS SOCIALES — quotes editoriales LATAM PYMEs
// Layout: 1 grande + 3 medianas. Estilo magazine.
// ============================================================

interface Testimonio {
  cita: string;
  autor: string;
  rol: string;
  iniciales: string;
  pais: string;
  metrica?: string;
}

const DESTACADO: Testimonio = {
  cita: "Antes perdía clientes por no contestar de noche o los findes. La IA cierra ventas mientras duermo. En 3 meses pasé de 120 a 410 turnos por mes — y atiendo el doble de pacientes con el mismo equipo.",
  autor: "Dra. Carolina Méndez",
  rol: "Odontología Méndez · Bogotá",
  iniciales: "CM",
  pais: "CO",
  metrica: "+241% turnos",
};

const SECUNDARIOS: Testimonio[] = [
  {
    cita: "Lo enchufé un viernes, el sábado ya estaba vendiendo. El cliente ni se entera que es una IA — responde con el mismo tono que yo.",
    autor: "Martín Acosta",
    rol: "Joyería Acosta · Buenos Aires",
    iniciales: "MA",
    pais: "AR",
    metrica: "setup en 1 día",
  },
  {
    cita: "Migramos de Wati y la diferencia es brutal. Cero código, soporte que responde en minutos y el costo es 4× menor.",
    autor: "Laura Beltrán",
    rol: "Inmobiliaria del Sur · Monterrey",
    iniciales: "LB",
    pais: "MX",
    metrica: "−74% costo",
  },
  {
    cita: "Tengo 3 sucursales y antes era un caos: tres números, tres celulares, tres operadores. Ahora un panel, una IA, todo etiquetado.",
    autor: "Roberto Silva",
    rol: "Carnicerías Silva · Santiago",
    iniciales: "RS",
    pais: "CL",
    metrica: "3 sucursales · 1 panel",
  },
];

function Bandera({ pais }: { pais: string }) {
  return (
    <span
      aria-label={`País: ${pais}`}
      className="inline-flex h-4 items-center justify-center rounded-sm border border-white/10 bg-black px-1.5 font-mono text-[8px] tracking-[0.15em] text-white/50"
    >
      {pais}
    </span>
  );
}

function Avatar({ iniciales }: { iniciales: string }) {
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 font-mono text-[11px] font-semibold text-emerald-300"
    >
      {iniciales}
    </div>
  );
}

export function TestimoniosSociales() {
  return (
    <section
      aria-labelledby="testimonios-titulo"
      className="relative border-y border-white/[0.06] bg-[#080808]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(16,185,129,0.08),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
              // historias reales
            </p>
            <h2
              id="testimonios-titulo"
              className="text-4xl tracking-[-0.025em] text-white md:text-5xl"
            >
              PYMEs que ya{" "}
              <span className="font-display italic text-white/70">
                duplicaron
              </span>{" "}
              sus ventas.
            </h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              +800 negocios activos
            </span>
          </div>
        </div>

        <div className="grid gap-px bg-white/[0.06] md:grid-cols-3">
          {/* Testimonio destacado (ocupa 2 col en md) */}
          <article className="group relative col-span-1 flex flex-col gap-6 bg-black p-8 transition-colors hover:bg-white/[0.015] md:col-span-2 md:p-10">
            <span
              aria-hidden
              className="font-display text-7xl leading-none text-emerald-400/30"
            >
              &ldquo;
            </span>
            <blockquote className="font-display text-2xl leading-snug tracking-[-0.01em] text-white md:text-[28px]">
              {DESTACADO.cita}
            </blockquote>
            <footer className="mt-auto flex items-center justify-between gap-4 border-t border-white/[0.06] pt-5">
              <div className="flex items-center gap-3">
                <Avatar iniciales={DESTACADO.iniciales} />
                <div>
                  <p className="text-[13px] font-medium text-white">
                    {DESTACADO.autor}
                  </p>
                  <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    {DESTACADO.rol} <Bandera pais={DESTACADO.pais} />
                  </p>
                </div>
              </div>
              {DESTACADO.metrica && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                  {DESTACADO.metrica}
                </span>
              )}
            </footer>
          </article>

          {/* Primer secundario */}
          <article className="group flex flex-col gap-5 bg-black p-7 transition-colors hover:bg-white/[0.015]">
            <span
              aria-hidden
              className="font-display text-4xl leading-none text-emerald-400/30"
            >
              &ldquo;
            </span>
            <blockquote className="text-[15px] leading-relaxed text-white/85">
              {SECUNDARIOS[0].cita}
            </blockquote>
            <footer className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-4">
              <Avatar iniciales={SECUNDARIOS[0].iniciales} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-white">
                  {SECUNDARIOS[0].autor}
                </p>
                <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                  <span className="truncate">{SECUNDARIOS[0].rol}</span>
                  <Bandera pais={SECUNDARIOS[0].pais} />
                </p>
              </div>
            </footer>
          </article>
        </div>

        {/* Fila inferior con 2 testimonios restantes */}
        <div className="mt-px grid gap-px bg-white/[0.06] md:grid-cols-2">
          {SECUNDARIOS.slice(1).map((t) => (
            <article
              key={t.autor}
              className="group flex flex-col gap-5 bg-black p-7 transition-colors hover:bg-white/[0.015]"
            >
              <span
                aria-hidden
                className="font-display text-4xl leading-none text-emerald-400/30"
              >
                &ldquo;
              </span>
              <blockquote className="text-[15px] leading-relaxed text-white/85">
                {t.cita}
              </blockquote>
              <footer className="mt-auto flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
                <div className="flex items-center gap-3">
                  <Avatar iniciales={t.iniciales} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white">
                      {t.autor}
                    </p>
                    <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                      <span className="truncate">{t.rol}</span>
                      <Bandera pais={t.pais} />
                    </p>
                  </div>
                </div>
                {t.metrica && (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.02] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/60">
                    {t.metrica}
                  </span>
                )}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
