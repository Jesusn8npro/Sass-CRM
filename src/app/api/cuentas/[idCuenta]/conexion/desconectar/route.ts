import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import {
  actualizarCuenta,
  actualizarEstadoCuenta,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

interface Body {
  /** Si true, también pausa la cuenta (esta_activa=false) → el gestor
   *  no la auto-reconecta hasta que el user la reactive. Default false:
   *  mantiene el flow de "regenerar QR" (desconectar y dejar que el
   *  gestor reabra con QR nuevo). */
  pausar?: boolean;
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* sin body es OK — default flow regenerar QR */
  }
  const pausar = body.pausar === true;

  await actualizarEstadoCuenta(idCuenta, {
    estado: "desconectado",
    cadena_qr: null,
    telefono: null,
  });

  // Si pausar=true, marcamos esta_activa=false para que el gestor
  // (sincronizar cada 3s) NO la auto-reconecte. El user la reactiva
  // explicitamente con PATCH /api/cuentas/[idCuenta] {esta_activa:true}
  // o con el boton "Reactivar" en /whatsapp.
  if (pausar) {
    await actualizarCuenta(idCuenta, {
      esta_activa: false,
    } as Parameters<typeof actualizarCuenta>[1]);
  }

  const dirAuth = path.resolve(process.cwd(), "auth", String(idCuenta));
  try {
    fs.rmSync(dirAuth, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[api] no se pudo limpiar auth/${idCuenta}:`, err);
  }

  return NextResponse.json({ ok: true, pausada: pausar });
}
