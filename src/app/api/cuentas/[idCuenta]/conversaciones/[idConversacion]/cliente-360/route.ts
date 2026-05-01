import { NextResponse, type NextRequest } from "next/server";
import {
  listarInteresDeConversacion,
  listarLlamadasDeConversacion,
  obtenerConversacionPorId,
  obtenerCuenta,
  obtenerEtapa,
  obtenerHistorialReciente,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

/**
 * Cliente 360: vista consolidada de TODO lo que tenemos de un contacto
 *  - datos de la conversación + etapa pipeline
 *  - últimos mensajes (recientes)
 *  - llamadas Vapi
 *  - productos en los que mostró interés
 *  - emails y teléfonos capturados de SUS mensajes (filtrados por la conv)
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta, idConversacion } = await params;
  const idC = Number(idCuenta);
  const idConv = Number(idConversacion);
  if (
    !Number.isFinite(idC) ||
    idC <= 0 ||
    !Number.isFinite(idConv) ||
    idConv <= 0
  ) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  const cuenta = obtenerCuenta(idC);
  if (!cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conversacion = obtenerConversacionPorId(idConv);
  if (!conversacion || conversacion.cuenta_id !== idC) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const etapa = conversacion.etapa_id
    ? obtenerEtapa(conversacion.etapa_id)
    : null;

  const productos_interes = listarInteresDeConversacion(idConv);
  const llamadas = listarLlamadasDeConversacion(idConv);
  const ultimos_mensajes = obtenerHistorialReciente(idConv, 50);

  // Estadísticas rápidas
  const total_mensajes = ultimos_mensajes.length;
  const recibidos = ultimos_mensajes.filter((m) => m.rol === "usuario").length;
  const respuestas_ia = ultimos_mensajes.filter(
    (m) => m.rol === "asistente",
  ).length;
  const respuestas_humano = ultimos_mensajes.filter(
    (m) => m.rol === "humano",
  ).length;

  return NextResponse.json({
    conversacion,
    etapa,
    productos_interes,
    llamadas,
    ultimos_mensajes,
    estadisticas: {
      total_mensajes,
      recibidos,
      respuestas_ia,
      respuestas_humano,
      cantidad_llamadas: llamadas.length,
      productos_distintos: productos_interes.length,
    },
  });
}
