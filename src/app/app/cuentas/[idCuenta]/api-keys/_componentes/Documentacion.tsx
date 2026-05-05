"use client";

/**
 * Documentación inline para la API v1.
 *
 * Muestra el header de auth y 3 ejemplos curl. Link a docs externas
 * (placeholder por ahora).
 */
import { useParams } from "next/navigation";
import { useState } from "react";

export function Documentacion() {
  const { idCuenta } = useParams<{ idCuenta: string }>();
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiar(id: string, texto: string) {
    void navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://app.sass-crm.com";

  const ejemploEnviar = `curl -X POST "${baseUrl}/api/v1/conversaciones/${idCuenta}/mensaje" \\
  -H "Authorization: Bearer sk_live_TU_CLAVE_ACA" \\
  -H "Content-Type: application/json" \\
  -d '{
    "telefono": "5491123456789",
    "contenido": "Hola, ¿cómo estás?"
  }'`;

  const ejemploListar = `curl "${baseUrl}/api/v1/conversaciones/${idCuenta}?limite=20" \\
  -H "Authorization: Bearer sk_live_TU_CLAVE_ACA"`;

  const ejemploInfo = `curl "${baseUrl}/api/v1/cuentas/${idCuenta}/info" \\
  -H "Authorization: Bearer sk_live_TU_CLAVE_ACA"`;

  return (
    <section className="border-t border-zinc-200 bg-white px-6 py-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-lg font-bold tracking-tight">
          Cómo usar tu API key
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Todas las requests requieren el header{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
            Authorization: Bearer sk_live_...
          </code>
        </p>

        <div className="mt-6 space-y-5">
          <BloqueEjemplo
            id="enviar"
            titulo="Enviar mensaje"
            metodo="POST"
            color="emerald"
            ruta={`/api/v1/conversaciones/${idCuenta}/mensaje`}
            descripcion="Encola un mensaje saliente. El bot lo despacha por WhatsApp en segundos."
            ejemplo={ejemploEnviar}
            copiado={copiado === "enviar"}
            onCopiar={() => copiar("enviar", ejemploEnviar)}
          />
          <BloqueEjemplo
            id="listar"
            titulo="Listar conversaciones"
            metodo="GET"
            color="blue"
            ruta={`/api/v1/conversaciones/${idCuenta}`}
            descripcion="Devuelve las últimas N conversaciones. Parámetro opcional ?limite=N (máx 200)."
            ejemplo={ejemploListar}
            copiado={copiado === "listar"}
            onCopiar={() => copiar("listar", ejemploListar)}
          />
          <BloqueEjemplo
            id="info"
            titulo="Info de la cuenta"
            metodo="GET"
            color="violet"
            ruta={`/api/v1/cuentas/${idCuenta}/info`}
            descripcion="Datos básicos + métricas resumen (mensajes hoy, citas próximas, etc.)."
            ejemplo={ejemploInfo}
            copiado={copiado === "info"}
            onCopiar={() => copiar("info", ejemploInfo)}
          />
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p>
            ¿Querés ver todos los endpoints, los códigos de error y schemas
            completos?{" "}
            <a
              href="https://docs.sass-crm.com/api"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Documentación completa →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

function BloqueEjemplo({
  titulo,
  metodo,
  color,
  ruta,
  descripcion,
  ejemplo,
  copiado,
  onCopiar,
}: {
  id: string;
  titulo: string;
  metodo: "GET" | "POST";
  color: "emerald" | "blue" | "violet";
  ruta: string;
  descripcion: string;
  ejemplo: string;
  copiado: boolean;
  onCopiar: () => void;
}) {
  const colorClases: Record<
    typeof color,
    { badge: string; ruta: string }
  > = {
    emerald: {
      badge:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      ruta: "text-emerald-700 dark:text-emerald-300",
    },
    blue: {
      badge:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      ruta: "text-blue-700 dark:text-blue-300",
    },
    violet: {
      badge:
        "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
      ruta: "text-violet-700 dark:text-violet-300",
    },
  };
  const c = colorClases[color];

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${c.badge}`}
          >
            {metodo}
          </span>
          <code className={`flex-1 truncate font-mono text-xs ${c.ruta}`}>
            {ruta}
          </code>
        </div>
        <p className="mt-1.5 text-xs font-semibold">{titulo}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{descripcion}</p>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto bg-zinc-950 px-4 py-3 text-[11px] leading-relaxed text-zinc-100">
          <code>{ejemplo}</code>
        </pre>
        <button
          type="button"
          onClick={onCopiar}
          className="absolute right-2 top-2 rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          {copiado ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
    </article>
  );
}
