import { NextResponse, type NextRequest } from "next/server";
import {
  listarLlamadasDeCuenta,
  obtenerCuenta,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { iniciarLlamadaConContexto } from "@/lib/llamadas";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

function validarId(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const llamadas = listarLlamadasDeCuenta(id);
  return NextResponse.json({ llamadas });
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = obtenerCuenta(id);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  let payload: { telefono?: unknown; nombre?: unknown; motivo?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

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
  const conversacion = obtenerOCrearConversacion(id, soloDigitos, nombre);

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
