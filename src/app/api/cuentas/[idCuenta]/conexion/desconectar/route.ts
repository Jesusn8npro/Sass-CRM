import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import {
  actualizarCuenta,
  actualizarEstadoCuenta,
} from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { obtenerGestor } from "@/lib/baileys/gestor";
import { borrarSesionBaileysDeCuenta } from "@/lib/baileys/auth-supabase";

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
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* sin body es OK — default flow regenerar QR */
  }
  const pausar = body.pausar === true;

  // Cierre INTENCIONAL: llama sock.logout() para que WhatsApp desvincule el
  // dispositivo del teléfono (no solo soltar el socket local). El guard de
  // 'loggedOut' evita falsas alertas de "cuenta caída".
  await obtenerGestor().cerrarSesionIntencional(idCuenta);

  // Limpiar credenciales de Supabase para forzar QR nuevo. Awaited para que
  // el sincronizar() de abajo no reconecte con creds viejas.
  await borrarSesionBaileysDeCuenta(idCuenta).catch(() => {});

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

  // Si NO se pausó la cuenta, disparamos una reconexión inmediata para que
  // el QR nuevo aparezca en ~2-3s en vez de esperar el ciclo de
  // sincronizar() (cada 30s). Si se pausó (esta_activa=false), sincronizar
  // la ignora — no regenera QR, queda apagada como se pidió.
  if (!pausar && process.env.BOT_ENABLED !== "false") {
    void obtenerGestor().sincronizar();
  }

  return NextResponse.json({ ok: true, pausada: pausar });
}
