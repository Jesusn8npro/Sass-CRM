import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta, obtenerRunApify } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { mapearItem } from "@/lib/apify/actors";
import { leerDataset } from "@/lib/apify/cliente";
import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Contexto {
  params: Promise<{ idCuenta: string; idRun: string }>;
}

interface FilaResultado {
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  sitio_web: string | null;
  categoria: string | null;
  /** ID de la conversacion creada (para deep-link al CRM). Null si no
   *  se pudo asociar (ej. era duplicado). */
  conversacion_id: string | null;
}

/**
 * GET /api/cuentas/[idCuenta]/apify/runs/[idRun]/resultados
 *
 * Lee el dataset desde Apify (no lo cacheamos en DB para ahorrar
 * storage) y mappea cada item a la estructura usable. Adicionalmente
 * resuelve el conversacion_id buscando por telefono — asi el frontend
 * puede armar deep-link "Ver en CRM".
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idRun } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  const run = await obtenerRunApify(idRun);
  if (!run || run.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "run_no_encontrado" }, { status: 404 });
  }
  if (!run.apify_dataset_id) {
    return NextResponse.json(
      { error: "sin_dataset", mensaje: "Este run todavía no terminó" },
      { status: 400 },
    );
  }

  const items = await leerDataset(run.apify_dataset_id, 500);
  const mapeados = items
    .map((it) => mapearItem(run.actor_id, it))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Resolver conversacion_id buscando por telefono. Hacemos UN query
  // batch para no llamar N veces a la DB.
  const telefonosUnicos = mapeados
    .map((m) => m.telefono?.replace(/[^\d+a-zA-Z_]/g, "").slice(0, 32))
    .filter((t): t is string => !!t);
  const mapaConvs = new Map<string, string>();
  if (telefonosUnicos.length > 0) {
    const { data } = await db()
      .from("conversaciones")
      .select("id, telefono")
      .eq("cuenta_id", idCuenta)
      .in("telefono", telefonosUnicos);
    for (const c of (data ?? []) as Array<{ id: string; telefono: string }>) {
      mapaConvs.set(c.telefono, c.id);
    }
  }

  const resultados: FilaResultado[] = mapeados.map((m) => {
    const telLimpio = m.telefono?.replace(/[^\d+a-zA-Z_]/g, "").slice(0, 32);
    return {
      nombre: m.nombre,
      telefono: m.telefono,
      email: m.email,
      direccion: m.direccion,
      sitio_web: m.sitio_web,
      categoria: m.categoria,
      conversacion_id: telLimpio ? (mapaConvs.get(telLimpio) ?? null) : null,
    };
  });

  return NextResponse.json({ resultados });
}
