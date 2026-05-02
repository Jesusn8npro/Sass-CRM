import { NextResponse, type NextRequest } from "next/server";
import {
  listarLlamadasDeCuenta,
  obtenerCuenta,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { iniciarLlamadaConContexto } from "@/lib/llamadas";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
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
  const llamadas = await listarLlamadasDeCuenta(idCuenta);
  return NextResponse.json({ llamadas });
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
