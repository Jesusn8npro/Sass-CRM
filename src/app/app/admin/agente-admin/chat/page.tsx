import Link from "next/link";
import { obtenerCuentaPanelAdmin } from "@/lib/baseDatos";
import { ChatUI } from "./ChatUI";

export const dynamic = "force-dynamic";

export default async function PaginaChatAdmin() {
  const cuenta = await obtenerCuentaPanelAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <Link
          href="/app/admin/agente-admin"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          ← volver al agente admin
        </Link>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
              // chat con marco
            </p>
            <h1 className="font-display mt-2 text-3xl italic leading-tight text-zinc-900 dark:text-white md:text-4xl">
              Marco · canal web
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-white/55">
              Charlá con Marco directo desde el panel — sin depender de
              WhatsApp/Baileys. Mismo agente, mismas herramientas, historial
              persistente. Si el WA falla por conflicto de conexión, este
              canal siempre responde.
            </p>
          </div>
        </div>
      </header>

      {!cuenta ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            ⚠ No tenés cuenta panel admin marcada
          </p>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300/80">
            Marcá una primero antes de chatear con Marco — necesita una
            conversación virtual donde guardar el historial.
          </p>
          <Link
            href="/app/admin/agente-admin"
            className="mt-4 inline-block rounded-full bg-amber-600 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white hover:bg-amber-700"
          >
            ir a marcar cuenta →
          </Link>
        </div>
      ) : (
        <ChatUI />
      )}
    </div>
  );
}
