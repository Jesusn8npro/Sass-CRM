import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { crearClienteAdmin } from "@/lib/supabase/cliente-servidor";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idWebhook: string }>;
}

function db() {
  return crearClienteAdmin();
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta, idWebhook } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const payload = await parsearJSON<Record<string, unknown>>(req);
  if (payload instanceof NextResponse) return payload;

  const cambios: Record<string, unknown> = {};
  if (typeof payload.nombre === "string")
    cambios.nombre = payload.nombre.trim();
  if (typeof payload.url === "string") cambios.url = payload.url.trim();
  if (Array.isArray(payload.eventos)) cambios.eventos = payload.eventos;
  if (typeof payload.secret === "string" || payload.secret === null)
    cambios.secret = payload.secret;
  if (typeof payload.esta_activo === "boolean")
    cambios.esta_activo = payload.esta_activo;

  const { data, error } = await db()
    .from("webhooks_salientes")
    .update(cambios)
    .eq("id", idWebhook)
    .eq("cuenta_id", idCuenta)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ webhook: data });
}

export async function DELETE(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idWebhook } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  await db()
    .from("webhooks_salientes")
    .delete()
    .eq("id", idWebhook)
    .eq("cuenta_id", idCuenta);
  return NextResponse.json({ ok: true });
}
