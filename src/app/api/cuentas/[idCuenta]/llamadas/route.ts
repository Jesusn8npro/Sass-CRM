import { NextResponse, type NextRequest } from "next/server";
import {
  listarLlamadasDeCuenta,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { iniciarLlamadaConContexto } from "@/lib/llamadas";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const llamadas = await listarLlamadasDeCuenta(idCuenta);
  return NextResponse.json({ llamadas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;

  const payload = await parsearJSON<{ telefono?: unknown; nombre?: unknown; motivo?: unknown }>(req);
  if (payload instanceof NextResponse) return payload;

  const telefonoRaw =
    typeof payload.telefono === "string" ? payload.telefono : "";
  const soloDigitos = telefonoRaw.replace(/[^\d]/g, "");
  if (soloDigitos.length < 8 || soloDigitos.length > 15) {
    return NextResponse.json(
      { error: "Número inválido. Incluí código de país." },
      { status: 400 },
    );
  }
  const nombre =
    typeof payload.nombre === "string" && payload.nombre.trim()
      ? payload.nombre.trim()
      : null;
  const motivo =
    typeof payload.motivo === "string" && payload.motivo.trim()
      ? payload.motivo.trim()
      : null;

  // Crear o recuperar conversación local — el contexto sale de su historial.
  const conversacion = await obtenerOCrearConversacion(
    idCuenta,
    soloDigitos,
    nombre,
  );

  const resultado = await iniciarLlamadaConContexto({
    cuenta,
    conversacion,
    motivo,
    origen: "humano",
  });

  if (!resultado.ok) {
    const status =
      resultado.motivoBloqueo === "vapi_no_configurado" ||
      resultado.motivoBloqueo === "telefono_invalido"
        ? 400
        : resultado.motivoBloqueo === "cooldown"
        ? 429
        : 502;
    return NextResponse.json({ error: resultado.error }, { status });
  }
  return NextResponse.json({ llamada: resultado.llamada }, { status: 201 });
}
