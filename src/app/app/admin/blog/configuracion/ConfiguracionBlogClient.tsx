"use client";

import { useState, useTransition } from "react";

interface BlogConfig {
  activo: boolean;
  horas: number[];
  dias_semana: number[];
  max_por_dia: number;
  longitud: "corto" | "medio" | "largo";
  tier_portada: "pro" | "estandar";
  modo_imagenes: "sin-imagenes" | "solo-portada" | "completo";
  actualizado_en: string;
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HORAS_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return `${h}:00 UTC`;
});

export function ConfiguracionBlogClient({ configInicial }: { configInicial: BlogConfig }) {
  const [config, setConfig] = useState<BlogConfig>(configInicial);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleHora(hora: number) {
    setConfig((prev) => {
      const tiene = prev.horas.includes(hora);
      const nuevas = tiene
        ? prev.horas.filter((h) => h !== hora)
        : [...prev.horas, hora].sort((a, b) => a - b);
      return { ...prev, horas: nuevas.length > 0 ? nuevas : prev.horas };
    });
  }

  function toggleDia(dia: number) {
    setConfig((prev) => {
      const tiene = prev.dias_semana.includes(dia);
      const nuevos = tiene
        ? prev.dias_semana.filter((d) => d !== dia)
        : [...prev.dias_semana, dia].sort((a, b) => a - b);
      return { ...prev, dias_semana: nuevos.length > 0 ? nuevos : prev.dias_semana };
    });
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      try {
        const r = await fetch("/api/admin/blog/config", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            activo: config.activo,
            horas: config.horas,
            dias_semana: config.dias_semana,
            max_por_dia: config.max_por_dia,
            longitud: config.longitud,
            tier_portada: config.tier_portada,
            modo_imagenes: config.modo_imagenes,
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setError(d.error ?? "Error al guardar");
          return;
        }
        const actualizado = await r.json();
        setConfig(actualizado);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 3000);
      } catch {
        setError("Error de conexión");
      }
    });
  }

  return (
    <div className="space-y-8">

      {/* Estado general */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
              // estado del sistema
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
              Generación automática
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-white/40">
              El cron corre cada hora en Vercel y verifica si debe generar según el horario configurado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, activo: !p.activo }))}
            className={`relative inline-flex h-7 w-13 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              config.activo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-white/20"
            }`}
          >
            <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-200 ${config.activo ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
        {!config.activo && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 font-mono text-[11px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            ⚠ Generación desactivada — el cron saltará ejecuciones hasta que actives esto.
          </p>
        )}
      </section>

      {/* Horas */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // horas de publicación (UTC)
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
          ¿A qué hora generar?
        </h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-white/40">
          Seleccioná las horas UTC en que se dispara la generación. Podés elegir varias.
        </p>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
          {Array.from({ length: 24 }, (_, h) => {
            const activa = config.horas.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleHora(h)}
                title={HORAS_LABELS[h]}
                className={`rounded-lg border px-2 py-2 font-mono text-[11px] transition-colors ${
                  activa
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-white/[0.08] dark:text-white/40 dark:hover:border-white/20"
                }`}
              >
                {h.toString().padStart(2, "0")}h
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[11px] text-zinc-400 dark:text-white/30">
          Horas activas:{" "}
          <span className="text-emerald-600 dark:text-emerald-400">
            {config.horas.map((h) => `${h.toString().padStart(2, "0")}:00`).join(", ")}
          </span>
          {" "}· El servidor está en UTC.
        </p>
      </section>

      {/* Días */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // días habilitados
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
          ¿Qué días publicar?
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {DIAS.map((nombre, idx) => {
            const activo = config.dias_semana.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDia(idx)}
                className={`rounded-full border px-4 py-2 font-mono text-[11px] transition-colors ${
                  activo
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-white/[0.08] dark:text-white/40"
                }`}
              >
                {nombre}
              </button>
            );
          })}
        </div>
      </section>

      {/* Opciones de contenido */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // opciones de contenido
        </p>
        <h2 className="mt-1 mb-5 text-lg font-semibold text-zinc-900 dark:text-white">
          Calidad y formato
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">

          {/* Max por día */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Máx. artículos por día
            </label>
            <select
              value={config.max_por_dia}
              onChange={(e) => setConfig((p) => ({ ...p, max_por_dia: Number(e.target.value) }))}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Longitud */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Longitud del artículo
            </label>
            <select
              value={config.longitud}
              onChange={(e) => setConfig((p) => ({ ...p, longitud: e.target.value as "corto" | "medio" | "largo" }))}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="corto">Corto (800–1200 palabras)</option>
              <option value="medio">Medio (1500–2500 palabras)</option>
              <option value="largo">Largo (2500–3500 palabras)</option>
            </select>
          </div>

          {/* Imágenes */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Imágenes
            </label>
            <select
              value={config.modo_imagenes}
              onChange={(e) => setConfig((p) => ({ ...p, modo_imagenes: e.target.value as BlogConfig["modo_imagenes"] }))}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="completo">Completo (portada + inline)</option>
              <option value="solo-portada">Solo portada</option>
              <option value="sin-imagenes">Sin imágenes (más rápido)</option>
            </select>
          </div>

          {/* Tier portada */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Calidad portada
            </label>
            <select
              value={config.tier_portada}
              onChange={(e) => setConfig((p) => ({ ...p, tier_portada: e.target.value as "pro" | "estandar" }))}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="pro">Pro (Gemini 3 — más costoso, más clickbait)</option>
              <option value="estandar">Estándar (Flash — más rápido, más barato)</option>
            </select>
          </div>

        </div>
      </section>

      {/* Resumen del horario */}
      <section className="rounded-2xl border border-white/[0.06] bg-zinc-950/50 p-5 dark:bg-white/[0.01]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          // próximas ejecuciones programadas
        </p>
        <div className="mt-3 space-y-1">
          {config.activo ? (
            config.dias_semana.flatMap((dia) =>
              config.horas.map((hora) => (
                <p key={`${dia}-${hora}`} className="font-mono text-xs text-zinc-400 dark:text-white/50">
                  {DIAS[dia]} a las {hora.toString().padStart(2, "0")}:00 UTC
                </p>
              )),
            )
          ) : (
            <p className="font-mono text-xs text-amber-500">Desactivado — no se generarán artículos.</p>
          )}
        </div>
      </section>

      {/* Acciones */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-full bg-emerald-600 px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
        {guardado && (
          <span className="font-mono text-[11px] text-emerald-500">✓ Guardado correctamente</span>
        )}
        {error && (
          <span className="font-mono text-[11px] text-red-500">{error}</span>
        )}
        <span className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-white/30">
          Última actualización: {new Date(config.actualizado_en).toLocaleString("es")}
        </span>
      </div>

    </div>
  );
}
