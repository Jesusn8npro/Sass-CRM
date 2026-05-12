import { obtenerCuentaPanelAdmin } from "@/lib/baseDatos";
import { db } from "@/lib/db/cliente";
import { Selector } from "./Selector";

export const dynamic = "force-dynamic";

interface CuentaResumen {
  id: string;
  etiqueta: string;
  telefono: string | null;
  estado: string;
  usuario_email: string;
}

async function listarCuentasParaSelector(): Promise<CuentaResumen[]> {
  const { data, error } = await db()
    .from("cuentas")
    .select("id, etiqueta, telefono, estado, usuario_id")
    .eq("esta_archivada", false)
    .order("creada_en", { ascending: false })
    .limit(100);
  if (error) throw new Error(`listarCuentasParaSelector: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Adjuntar email del dueño en 1 query batch
  const idsUsuarios = [...new Set(data.map((c) => c.usuario_id as string))];
  const { data: usuarios } = await db()
    .from("usuarios")
    .select("id, email")
    .in("id", idsUsuarios);
  const mapaEmail = new Map(
    (usuarios ?? []).map((u) => [u.id as string, (u.email as string) ?? ""]),
  );

  return data.map((c) => ({
    id: c.id as string,
    etiqueta: (c.etiqueta as string) ?? "(sin etiqueta)",
    telefono: (c.telefono as string | null) ?? null,
    estado: (c.estado as string) ?? "desconocido",
    usuario_email: mapaEmail.get(c.usuario_id as string) ?? "(?)",
  }));
}

export default async function PaginaAgenteAdmin() {
  const [cuentaActual, cuentas] = await Promise.all([
    obtenerCuentaPanelAdmin(),
    listarCuentasParaSelector(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          // agente admin global
        </p>
        <h1 className="font-display mt-2 text-4xl italic leading-tight text-zinc-900 dark:text-white md:text-5xl">
          Canal admin del Patrón
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-white/55">
          Elegí una cuenta de WhatsApp del SaaS para que funcione como el
          canal admin dedicado. Solo procesa mensajes del super-admin
          (+57 312 379 0071). Cualquier otro remitente queda ignorado
          silenciosamente — el bot no responde ni guarda el mensaje.
        </p>
      </header>

      <section className="mb-10 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // estado actual
        </p>
        {cuentaActual ? (
          <div className="mt-3">
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              ✓ {cuentaActual.etiqueta}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-white/55">
              {cuentaActual.telefono ?? "(sin teléfono)"} · estado:{" "}
              {cuentaActual.estado}
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-white/70">
              Esta cuenta es tu canal admin. Cuando el Patrón le escribe,
              el bot ejecuta comandos (slash o lenguaje natural). Cuando
              cualquier otro número le escribe, se ignora silenciosamente.
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">
              ⚠ Sin canal admin configurado
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-white/70">
              Hoy el Patrón puede comandar desde cualquier número del SaaS.
              Para tener un canal dedicado y aislado, marcá una cuenta abajo.
            </p>
          </div>
        )}
      </section>

      <section>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // marcar cuenta como canal admin
        </p>
        <Selector
          cuentas={cuentas}
          cuentaActualId={cuentaActual?.id ?? null}
        />
      </section>

      <section className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-white/40">
          // cómo usarlo
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-white/70">
          <li>
            Creá una cuenta nueva en el SaaS (o usá una que tengas dedicada).
          </li>
          <li>Conectá el chip vía QR como hacés con cualquier cuenta cliente.</li>
          <li>Acá marcala como canal admin (toggle de arriba).</li>
          <li>
            Desde tu celular (+57 312 379 0071), escribile WhatsApp a ese
            número. Podés mandar comandos slash (/reporte, /post) o conversar
            en lenguaje natural ("cómo va todo hoy?", "armame un artículo
            sobre X").
          </li>
        </ol>
      </section>
    </div>
  );
}
