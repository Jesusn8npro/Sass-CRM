import { NextResponse, type NextRequest } from "next/server";
import {
  crearLlamadaVapi,
  listarLlamadasDeCuenta,
  obtenerCuenta,
  obtenerOCrearConversacion,
  listarConocimientoDeCuenta,
} from "@/lib/baseDatos";
import { iniciarLlamada } from "@/lib/vapi";

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
  if (!cuenta.vapi_api_key) {
    return NextResponse.json(
      { error: "Falta API key de Vapi en Ajustes → Llamadas." },
      { status: 400 },
    );
  }
  if (!cuenta.vapi_assistant_id) {
    return NextResponse.json(
      {
        error:
          "No hay Assistant de Vapi para esta cuenta. Andá a Ajustes → Llamadas → Sincronizar.",
      },
      { status: 400 },
    );
  }
  if (!cuenta.vapi_phone_id) {
    return NextResponse.json(
      {
        error: "Falta Phone Number ID de Vapi en Ajustes → Llamadas.",
      },
      { status: 400 },
    );
  }

  let payload: { telefono?: unknown; nombre?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const telefonoRaw =
    typeof payload.telefono === "string" ? payload.telefono : "";
  const telefonoLimpio = telefonoRaw.replace(/[^\d+]/g, "");
  // Vapi espera E.164 con prefijo +
  const telefonoE164 = telefonoLimpio.startsWith("+")
    ? telefonoLimpio
    : `+${telefonoLimpio}`;
  const soloDigitos = telefonoE164.replace(/[^\d]/g, "");
  if (soloDigitos.length < 8 || soloDigitos.length > 15) {
    return NextResponse.json(
      { error: "Número inválido. Incluí código de país (ej: +5491123456789)." },
      { status: 400 },
    );
  }
  const nombre =
    typeof payload.nombre === "string" && payload.nombre.trim()
      ? payload.nombre.trim()
      : null;

  // Crear o recuperar conversación local para que la llamada quede ligada.
  const conv = obtenerOCrearConversacion(id, soloDigitos, nombre);

  // Construimos un poco de contexto extra para meter en metadata.
  // El assistant ya tiene el system prompt completo via sincronizar;
  // metadata es para correlacionar el webhook después.
  void listarConocimientoDeCuenta(id); // (placeholder por si lo querés inyectar luego)

  try {
    const respuesta = await iniciarLlamada(cuenta.vapi_api_key, {
      assistantId: cuenta.vapi_assistant_id,
      phoneNumberId: cuenta.vapi_phone_id,
      numeroCliente: telefonoE164,
      nombreCliente: nombre ?? undefined,
      metadata: {
        cuenta_id: id,
        conversacion_id: conv.id,
      },
    });

    if (!respuesta.id) {
      throw new Error("Vapi no devolvió call id");
    }
    const llamada = crearLlamadaVapi(
      id,
      conv.id,
      respuesta.id,
      soloDigitos,
      "saliente",
    );
    return NextResponse.json({ llamada }, { status: 201 });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: detalle.slice(0, 500) },
      { status: 502 },
    );
  }
}
