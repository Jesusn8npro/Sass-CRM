import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

const EVENTOS_VALIDOS = [
  "mensaje_recibido",
  "mensaje_enviado",
  "contacto_nuevo",
  "cita_agendada",
  "llamada_terminada",
  "handoff_humano",
] as const;

function db() {
  return crearClienteAdmin();
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const { data, error } = await db()
    .from("webhooks_salientes")
    .select("*")
    .eq("cuenta_id", idCuenta)
    .order("creado_en", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    webhooks: data ?? [],
    eventos_disponibles: EVENTOS_VALIDOS,
  });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;
  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  let payload: {
    nombre?: unknown;
    url?: unknown;
    eventos?: unknown;
    secret?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const nombre =
    typeof payload.nombre === "string" ? payload.nombre.trim() : "";
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!nombre || !url) {
    return NextResponse.json(
      { error: "nombre y url son obligatorios" },
      { status: 400 },
    );
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return NextResponse.json(
      { error: "url debe ser http(s)://..." },
      { status: 400 },
    );
  }
  const eventos = Array.isArray(payload.eventos)
    ? payload.eventos.filter((e): e is string => typeof e === "string")
    : [];
  const secret =
    typeof payload.secret === "string" && payload.secret.trim()
      ? payload.secret.trim()
      : null;

  const { data, error } = await db()
    .from("webhooks_salientes")
    .insert({
      cuenta_id: idCuenta,
      nombre,
      url,
      eventos,
      secret,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ webhook: data });
}
