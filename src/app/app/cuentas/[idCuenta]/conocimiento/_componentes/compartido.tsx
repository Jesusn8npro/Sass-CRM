"use client";

import type { EntradaConocimiento } from "@/lib/baseDatos";

export const COLOR_CATEGORIA: Record<string, string> = {
  general: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  productos: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  precios: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  faqs: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  politicas: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  casos_uso: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  servicios: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
};

export function colorParaCategoria(cat: string): string {
  return (
    COLOR_CATEGORIA[cat] ??
    "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300"
  );
}

export const PLANTILLAS = [
  {
    nombre: "productos_servicios",
    titulo: "Productos y Servicios",
    descripcion: "Catálogo con precios, características y disponibilidad",
    icono: "📦",
    contenido: `# Productos y Servicios

## [Nombre del producto/servicio 1]
- Descripción: [qué es y para qué sirve]
- Precio: [valor o "consultar"]
- Disponibilidad: [stock, agenda, etc.]
- Características clave:
  - [feature 1]
  - [feature 2]
  - [feature 3]

## [Nombre del producto/servicio 2]
- Descripción: ...
- Precio: ...
- Disponibilidad: ...
- Características clave:
  - ...
`,
  },
  {
    nombre: "preguntas_frecuentes",
    titulo: "Preguntas Frecuentes",
    descripcion: "Formato pregunta-respuesta organizado por temas",
    icono: "❓",
    contenido: `# Preguntas Frecuentes (FAQ)

## ¿[Pregunta común 1]?
[Respuesta clara y completa, en 2-4 líneas máximo.]

## ¿[Pregunta común 2]?
[Respuesta...]

## ¿[Pregunta común 3]?
[Respuesta...]

---

Tip: agregá las preguntas que tu cliente realmente hace por WhatsApp.
Las que ves repetidas son las que más impactan en el agente.
`,
  },
  {
    nombre: "politicas_empresa",
    titulo: "Políticas de Empresa",
    descripcion: "Devoluciones, envíos, garantía y privacidad",
    icono: "📄",
    contenido: `# Políticas de la empresa

## Devoluciones
[Detalles de tu política de devoluciones]

## Envíos
- Zonas de cobertura: [...]
- Tiempos: [...]
- Costos: [...]

## Garantía
[Términos de la garantía]

## Privacidad
[Cómo manejás los datos de los clientes]
`,
  },
];

export function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  accent: "zinc" | "emerald" | "amber" | "violet";
}) {
  const ringByAccent: Record<typeof accent, string> = {
    zinc: "ring-zinc-200 dark:ring-zinc-800",
    emerald:
      "ring-emerald-300/50 dark:ring-emerald-500/30 bg-gradient-to-br from-emerald-50/70 to-transparent dark:from-emerald-950/30",
    amber:
      "ring-amber-300/50 dark:ring-amber-500/30 bg-gradient-to-br from-amber-50/70 to-transparent dark:from-amber-950/30",
    violet:
      "ring-violet-300/50 dark:ring-violet-500/30 bg-gradient-to-br from-violet-50/70 to-transparent dark:from-violet-950/30",
  };
  const iconBg: Record<typeof accent, string> = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  };
  return (
    <div
      className={`rounded-xl bg-white px-4 py-3 ring-1 dark:bg-zinc-900 ${ringByAccent[accent]}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${iconBg[accent]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function CardConocimiento({
  entrada,
  onClick,
}: {
  entrada: EntradaConocimiento;
  onClick: () => void;
}) {
  const cat = entrada.categoria || "general";
  const activo = entrada.esta_activo !== false;
  const preview = entrada.contenido.trim().slice(0, 220);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorParaCategoria(cat)}`}
        >
          {cat}
        </span>
      </div>
      <h3 className="mb-1 truncate font-semibold tracking-tight">
        {entrada.titulo}
      </h3>
      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {preview}
        {entrada.contenido.length > 220 && "…"}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
            activo
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-zinc-400"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-zinc-400"}`}
          />
          {activo ? "Activo" : "Inactivo"}
        </span>
        <span className="text-[10px] text-zinc-500">
          {entrada.contenido.length} chars
        </span>
      </div>
    </button>
  );
}
