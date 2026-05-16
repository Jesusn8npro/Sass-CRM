"use client";

import { useMemo, useState } from "react";

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm leading-snug text-white/60">{label}</span>
        <span className="font-mono text-sm font-semibold text-emerald-300 tabular-nums">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "#10b981" }}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10"
      />
      <div className="flex justify-between">
        <span className="font-mono text-[10px] text-white/25">{format(min)}</span>
        <span className="font-mono text-[10px] text-white/25">{format(max)}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border p-5 sm:p-6 ${
        accent
          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
        {label}
      </p>
      <p
        className={`font-display text-4xl italic leading-none tracking-tight tabular-nums sm:text-5xl ${
          accent ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function CalculadoraROI() {
  const [clientes, setClientes] = useState(30);
  const [minutosPorCliente, setMinutosPorCliente] = useState(30);
  const [costoHora, setCostoHora] = useState(10);
  const [pctFueraHorario, setPctFueraHorario] = useState(40);

  const { horasAhorradasMes, dineroAhorradoMes, leadsRecuperados, revenueRecuperado } =
    useMemo(() => {
      const horas = clientes * (minutosPorCliente / 60) * 26;
      const dinero = horas * costoHora;
      const leads = Math.round(clientes * (pctFueraHorario / 100) * 26);
      const revenue = leads * 25;
      return {
        horasAhorradasMes: horas,
        dineroAhorradoMes: dinero,
        leadsRecuperados: leads,
        revenueRecuperado: revenue,
      };
    }, [clientes, minutosPorCliente, costoHora, pctFueraHorario]);

  return (
    <section
      id="calculadora"
      className="border-t border-white/[0.06] bg-zinc-950 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400/80">
            ROI Calculator
          </p>
        </div>
        <h2 className="font-display text-4xl italic leading-tight tracking-tight text-white sm:text-6xl">
          Calculá tu{" "}
          <span className="text-emerald-400">ROI</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 sm:text-base">
          Mové los sliders y mirá cuánto tiempo y dinero podés recuperar
          automatizando tu WhatsApp con IA.
        </p>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Sliders */}
          <div className="flex flex-col gap-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
            <Slider
              label="Clientes por día que te escriben"
              value={clientes}
              min={5}
              max={500}
              step={5}
              format={(v) => String(v)}
              onChange={setClientes}
            />
            <Slider
              label="Tiempo respondiendo manualmente (min/cliente)"
              value={minutosPorCliente}
              min={5}
              max={120}
              step={5}
              format={(v) => `${v} min`}
              onChange={setMinutosPorCliente}
            />
            <Slider
              label="Costo por hora de tu equipo (USD)"
              value={costoHora}
              min={3}
              max={50}
              step={1}
              format={(v) => `$${v}`}
              onChange={setCostoHora}
            />
            <Slider
              label="% respuestas fuera del horario laboral"
              value={pctFueraHorario}
              min={10}
              max={100}
              step={5}
              format={(v) => `${v}%`}
              onChange={setPctFueraHorario}
            />
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 gap-3 self-start sm:grid-cols-2">
            <StatCard
              label="Horas liberadas por mes"
              value={Math.round(horasAhorradasMes).toLocaleString("es")}
            />
            <StatCard
              label="Ahorro operativo mensual"
              value={`$${Math.round(dineroAhorradoMes).toLocaleString("es")}`}
              accent
            />
            <StatCard
              label="Leads rescatados por mes"
              value={leadsRecuperados.toLocaleString("es")}
            />
            <StatCard
              label="Revenue potencial"
              value={`$${revenueRecuperado.toLocaleString("es")}`}
              accent
            />

            <div className="col-span-full mt-2">
              <a
                href="/signup"
                className="flex w-full items-center justify-center rounded-full bg-emerald-500 px-8 py-4 text-base font-semibold text-black shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400"
              >
                Empezar gratis →
              </a>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
                Sin tarjeta de crédito
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
