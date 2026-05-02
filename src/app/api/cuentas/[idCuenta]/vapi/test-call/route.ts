import { NextResponse, type NextRequest } from "next/server";
import {
  obtenerCuenta,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { iniciarLlamadaConContexto } from "@/lib/llamadas";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * Hace una llamada de prueba al número que pase el usuario (típicamente
 * a su propio celular). Crea/reutiliza una conversación con ese número
 * y lo dispara con el helper común. Útil para verificar configuración
 * sin depender de un cliente real.
 */
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

  let payload: { telefono?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tel = typeof payload.telefono === "string" ? payload.telefono : "";
  const soloDigitos = tel.replace(/[^\d]/g, "");
  if (soloDigitos.length < 8 || soloDigitos.length > 15) {
    return NextResponse.json(
      { error: "Número inválido. Incluí código de país." },
      { status: 400 },
    );
  }

  const conv = await obtenerOCrearConversacion(
    idCuenta,
    soloDigitos,
    "Prueba (test-call)",
  );

  const r = await iniciarLlamadaConContexto({
    cuenta,
    conversacion: conv,
    motivo: "Llamada de prueba desde Ajustes",
    origen: "humano",
  });

  if (!r.ok) {
    const status =
      r.motivoBloqueo === "vapi_no_configurado" ||
      r.motivoBloqueo === "telefono_invalido"
        ? 400
        : r.motivoBloqueo === "cooldown"
        ? 429
        : 502;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json({ llamada: r.llamada }, { status: 201 });
}
