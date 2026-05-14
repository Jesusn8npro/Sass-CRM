// ============================================================
// LOGOS / INTEGRACIONES — placeholders en mono con accent esmeralda
// Tira fina debajo del hero, da sensación de "está conectado a todo"
// ============================================================

const INTEGRACIONES = [
  "WhatsApp",
  "OpenAI",
  "Anthropic",
  "Google Gemini",
  "ElevenLabs",
  "Vapi",
  "Mercado Pago",
  "Stripe",
];

export function LogosClientes() {
  return (
    <section
      aria-label="Integraciones disponibles"
      className="border-b border-white/[0.06] bg-black"
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
            Conectado nativo con
          </p>
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-3 md:gap-x-9">
            {INTEGRACIONES.map((nombre) => (
              <li
                key={nombre}
                className="group flex items-center gap-2 font-mono text-[12px] tracking-tight text-white/55 transition-colors hover:text-white"
              >
                <span
                  aria-hidden
                  className="h-1 w-1 rounded-full bg-emerald-400/60 transition-all group-hover:h-1.5 group-hover:w-1.5 group-hover:bg-emerald-400"
                />
                {nombre}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
