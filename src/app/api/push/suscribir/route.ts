import { NextRequest, NextResponse } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import { db } from "@/lib/db/cliente";

interface Body {
  idCuenta: string;
  subscription: { endpoint: string; keys: Record<string, string> };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await parsearJSON<Body>(req);
  if (body instanceof NextResponse) return body;

  const acceso = await verificarAccesoCuenta(body.idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  const { endpoint, keys } = body.subscription;
  if (!endpoint || !keys) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  const { error } = await db().from("push_subscriptions").upsert(
    {
      usuario_id: auth.id,
      cuenta_id: body.idCuenta,
      endpoint,
      keys_json: keys,
    },
    { onConflict: "usuario_id,cuenta_id,endpoint" }
  );
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar la suscripción" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const body = await parsearJSON<{ idCuenta: string; endpoint: string }>(req);
  if (body instanceof NextResponse) return body;

  const acceso = await verificarAccesoCuenta(body.idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  const { error } = await db()
    .from("push_subscriptions")
    .delete()
    .eq("usuario_id", auth.id)
    .eq("cuenta_id", body.idCuenta)
    .eq("endpoint", body.endpoint);
  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar la suscripción" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
