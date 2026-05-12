import Link from "next/link";
import { obtenerCuentaPanelAdmin } from "@/lib/baseDatos";
import { SYSTEM_PROMPT_ADMIN_DEFAULT } from "@/lib/admin/conversacionAdmin";
import { EditorPrompt } from "./EditorPrompt";

export const dynamic = "force-dynamic";

export default async function PaginaConfigurarPrompt() {
  const cuenta = await obtenerCuentaPanelAdmin();
  const custom = cuenta?.prompt_sistema?.trim() ?? "";

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/app/admin/agente-admin"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          ← volver al agente admin
        </Link>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // configurar personalidad del agente
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          System prompt
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-white/55">
          Esto es lo que Claude lee al inicio de cada conversación admin —
          define el tono, las reglas de comportamiento y cuándo preguntar
          antes de actuar. Las herramientas (generar artículo, métricas,
          etc.) las inyecta el sistema aparte y no se pueden editar acá —
          vos controlás la personalidad, no el contrato técnico.
        </p>
      </header>

      {!cuenta ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            ⚠ No tenés cuenta panel admin marcada
          </p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300/80">
            Configurá una primero antes de poder editar el prompt.
          </p>
          <Link
            href="/app/admin/agente-admin"
            className="mt-4 inline-block rounded-full bg-amber-600 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white hover:bg-amber-700"
          >
            ir a marcar cuenta →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
              // estado actual
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-white/70">
              Cuenta panel admin:{" "}
              <span className="font-semibold">{cuenta.etiqueta}</span>{" "}
              {cuenta.telefono && (
                <span className="font-mono text-xs text-zinc-500 dark:text-white/40">
                  (+{cuenta.telefono})
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-white/70">
              Prompt activo:{" "}
              {custom.length > 0 ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ Custom ({custom.length} caracteres)
                </span>
              ) : (
                <span className="font-semibold text-zinc-500 dark:text-white/50">
                  Default ({SYSTEM_PROMPT_ADMIN_DEFAULT.length} caracteres)
                </span>
              )}
            </p>
          </div>

          <EditorPrompt
            promptCustomInicial={custom}
            promptDefault={SYSTEM_PROMPT_ADMIN_DEFAULT}
          />

          <section className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
              // tips
            </p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-white/70">
              <li>
                · Si dejás el textarea vacío y guardás, vuelve al prompt
                default del sistema.
              </li>
              <li>
                · Las herramientas (tools) están definidas en código —
                Claude las recibe automáticamente. Acá NO listes
                herramientas, solo personalidad y reglas de comportamiento.
              </li>
              <li>
                · El prompt es por la cuenta panel admin actual. Si cambiás
                de cuenta panel admin (marcás otra), el prompt vuelve a
                default hasta que lo configures de nuevo.
              </li>
              <li>
                · Cambios aplican al instante — la próxima vez que escribas
                al bot, ya usa el prompt nuevo (no hace falta reiniciar nada).
              </li>
              <li>
                · Mínimo 50 caracteres si guardás algo. Máximo 20.000.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
