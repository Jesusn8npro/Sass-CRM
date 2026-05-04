import { NextResponse, type NextRequest } from "next/server";
import {
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { iniciarLlamadaConContexto } from "@/lib/llamadas";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

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
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;

  const payload = await parsearJSON<{ telefono?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

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
