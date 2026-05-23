"use client";

import { useState, useTransition, useEffect } from "react";

interface BlogConfig {
  activo: boolean;
  horas: number[];
  minutos: number;
  dias_semana: number[];
  max_por_dia: number;
  longitud: "corto" | "medio" | "largo";
  tier_portada: "pro" | "estandar";
  modo_imagenes: "sin-imagenes" | "solo-portada" | "completo";
  tema_manual: string | null;
  actualizado_en: string;
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function ConfiguracionBlogClient({ configInicial }: { configInicial: BlogConfig }) {
  const [config, setConfig] = useState<BlogConfig>({
    ...configInicial,
    minutos: configInicial.minutos ?? 0,
    tema_manual: configInicial.tema_manual ?? null,
  });
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [disparando, setDisparando] = useState(false);
  const [resultadoCron, setResultadoCron] = useState<{ ok: boolean; texto: string } | null>(null);

  const [horaUTC, setHoraUTC] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setHoraUTC(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

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
            minutos: config.minutos,
            dias_semana: config.dias_semana,
            max_por_dia: config.max_por_dia,
            longitud: config.longitud,
            tier_portada: config.tier_portada,
            modo_imagenes: config.modo_imagenes,
            tema_manual: config.tema_manual,
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setError((d as { error?: string }).error ?? "Error al guardar");
          return;
        }
        const actualizado = await r.json() as BlogConfig;
        setConfig(actualizado);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 3000);
        // Registrar slot pendiente para mostrarlo en cron-logs
        if (actualizado.activo) {
          localStorage.setItem("blog_pending_slot", JSON.stringify({
            savedAt: Date.now(),
            horas: actualizado.horas,
            minutos: actualizado.minutos,
            dias: actualizado.dias_semana,
          }));
        }
      } catch {
        setError("Error de conexión");
      }
    });
  }

  async function dispararAhora() {
    setDisparando(true);
    setResultadoCron(null);
    try {
      const r = await fetch("/api/admin/blog/disparar-cron", { method: "POST" });
      const d = await r.json().catch(() => ({})) as Record<string, unknown>;
      if (r.ok && d.ok) {
        const slug = d.slug as string | undefined;
        const titulo = d.titulo as string | undefined;
        setResultadoCron({
          ok: true,
          texto: slug ? `✓ Artículo publicado: "${titulo}" → /blog/${slug}` : "✓ Generación completada",
        });
      } else if (r.ok && (d as { saltado?: boolean }).saltado) {
        setResultadoCron({ ok: false, texto: "Saltado (fuera de horario) — esto no debería pasar con ?forzar=1" });
      } else {
        const msg = (d.error as string) || (d.detalle as string) || `Error ${r.status}`;
        setResultadoCron({ ok: false, texto: `✗ ${msg}` });
      }
    } catch {
      setResultadoCron({ ok: false, texto: "✗ Error de conexión" });
    } finally {
      setDisparando(false);
    }
  }

  const mm = config.minutos.toString().padStart(2, "0");

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
              El cron corre cada 5 minutos en Vercel y verifica si debe generar según el horario configurado.
            </p>
          </div>
          {/* Toggle — h-7 w-12: inner span h-6 w-6, translate-x-5 cuando activo */}
          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, activo: !p.activo }))}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              config.activo ? "bg-emerald-500" : "bg-zinc-300 dark:bg-white/20"
            }`}
            role="switch"
            aria-checked={config.activo}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-200 ${
                config.activo ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {!config.activo && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 font-mono text-[11px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            ⚠ Generación desactivada — el cron saltará ejecuciones hasta que actives esto.
          </p>
        )}
      </section>

      {/* Horas + Minutos */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // horario de publicación (hora local)
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
          ¿A qué hora generar?
        </h2>
        <p className="mt-1 mb-3 text-sm text-zinc-500 dark:text-white/40">
          Elegí la hora local y el minuto exacto. El cron verifica cada minuto con ventana de ±4 min.
        </p>

        {/* Reloj local en vivo */}
        <div className="mb-4 inline-flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
            Ahora son las{" "}
            <strong>
              {horaUTC.getHours() === 0 ? 12 : horaUTC.getHours() > 12 ? horaUTC.getHours() - 12 : horaUTC.getHours()}:
              {horaUTC.getMinutes().toString().padStart(2, "0")}{" "}
              {horaUTC.getHours() >= 12 ? "PM" : "AM"}
            </strong>
            {" "}·{" "}
            <span className="text-zinc-500 dark:text-white/40">
              hora {horaUTC.getHours().toString().padStart(2, "0")} en el selector
            </span>
          </span>
        </div>

        {/* Selector de horas */}
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
          {Array.from({ length: 24 }, (_, h) => {
            const activa = config.horas.includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => toggleHora(h)}
                title={`${h === 0 ? 12 : h > 12 ? h - 12 : h}:${mm} ${h >= 12 ? "PM" : "AM"} (hora local)`}
                className={`rounded-lg border px-2 py-1.5 font-mono text-[10px] leading-tight transition-colors ${
                  activa
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-white/[0.08] dark:text-white/40 dark:hover:border-white/20"
                }`}
              >
                <span className="block">{h.toString().padStart(2, "0")}h</span>
                <span className="block text-[9px] opacity-70">{h >= 12 ? "PM" : "AM"}</span>
              </button>
            );
          })}
        </div>

        {/* Selector de minutos */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Minuto exacto (0–59)
            </label>
            <input
              type="number"
              min={0}
              max={59}
              value={config.minutos}
              onChange={(e) => {
                const v = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                setConfig((p) => ({ ...p, minutos: v }));
              }}
              className="mt-2 w-24 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            />
            <p className="mt-1 font-mono text-[10px] text-zinc-400 dark:text-white/30">
              ±15 min de ventana
            </p>
          </div>
          <div className="font-mono text-[11px] text-zinc-400 dark:text-white/30">
            Disparará en:{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {config.horas.map((h) => {
                const ampm = h >= 12 ? "PM" : "AM";
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                return `${h12}:${mm} ${ampm}`;
              }).join(", ")}
            </span>
          </div>
        </div>
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

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Longitud del artículo
            </label>
            <select
              value={config.longitud}
              onChange={(e) => setConfig((p) => ({ ...p, longitud: e.target.value as BlogConfig["longitud"] }))}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="corto">Corto (800–1200 palabras)</option>
              <option value="medio">Medio (1500–2500 palabras)</option>
              <option value="largo">Largo (2500–3500 palabras)</option>
            </select>
          </div>

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

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500 dark:text-white/40">
              Calidad portada
            </label>
            <select
              value={config.tier_portada}
              onChange={(e) => setConfig((p) => ({ ...p, tier_portada: e.target.value as BlogConfig["tier_portada"] }))}
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
            >
              <option value="pro">Pro (Gemini 3 — más costoso, más clickbait)</option>
              <option value="estandar">Estándar (Flash — más rápido, más barato)</option>
            </select>
          </div>

        </div>
      </section>

      {/* Tema manual */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // tema personalizado (opcional)
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
          Tu idea de artículo
        </h2>
        <p className="mt-1 mb-4 text-sm text-zinc-500 dark:text-white/40">
          Si escribís algo aquí, se usa como tema en vez de Perplexity. Dejalo vacío para que el sistema elija automáticamente.
        </p>
        <textarea
          value={config.tema_manual ?? ""}
          onChange={(e) => setConfig((p) => ({ ...p, tema_manual: e.target.value || null }))}
          placeholder="Ej: Cómo usar IA para automatizar el seguimiento de clientes en WhatsApp sin perder el toque personal"
          rows={3}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500/50 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/30"
        />
        {config.tema_manual && (
          <p className="mt-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
            ✓ Se usará este tema en la próxima generación (automática o manual).
          </p>
        )}
      </section>

      {/* Resumen del horario */}
      <section className="rounded-2xl border border-white/[0.06] bg-zinc-950/50 p-5 dark:bg-white/[0.01]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          // próximas ejecuciones programadas
        </p>
        <div className="mt-3 space-y-1">
          {config.activo ? (
            config.dias_semana.flatMap((dia) =>
              config.horas.map((hora) => {
                const ampm = hora >= 12 ? "PM" : "AM";
                const h12 = hora === 0 ? 12 : hora > 12 ? hora - 12 : hora;
                return (
                  <p key={`${dia}-${hora}`} className="font-mono text-xs text-zinc-400 dark:text-white/50">
                    {DIAS[dia]} a las {h12}:{mm} {ampm} (hora {hora.toString().padStart(2,"0")} en el sistema)
                  </p>
                );
              }),
            )
          ) : (
            <p className="font-mono text-xs text-amber-500">Desactivado — no se generarán artículos.</p>
          )}
        </div>
      </section>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-full bg-emerald-600 px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>

        <button
          type="button"
          onClick={() => void dispararAhora()}
          disabled={disparando}
          className="rounded-full border border-amber-400/60 bg-amber-50 px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
        >
          {disparando ? "Generando…" : "⚡ Generar ahora"}
        </button>

        {guardado && (
          <span className="font-mono text-[11px] text-emerald-500">✓ Guardado correctamente</span>
        )}
        {error && (
          <span className="font-mono text-[11px] text-red-500">{error}</span>
        )}
        {resultadoCron && (
          <span className={`font-mono text-[11px] ${resultadoCron.ok ? "text-emerald-500" : "text-red-400"}`}>
            {resultadoCron.texto}
          </span>
        )}

        <span className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-white/30">
          Última actualización: {new Date(config.actualizado_en).toLocaleString("es")}
        </span>
      </div>

    </div>
  );
}
