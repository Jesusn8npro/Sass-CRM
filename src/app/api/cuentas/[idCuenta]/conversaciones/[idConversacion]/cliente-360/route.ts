import { NextResponse, type NextRequest } from "next/server";
import {
  listarInteresDeConversacion,
  listarLlamadasDeConversacion,
  obtenerConversacionPorId,
  obtenerCuenta,
  obtenerEtapa,
  obtenerHistorialReciente,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

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
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idConversacion } = await params;
  if (!idCuenta || !idConversacion) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conversacion = await obtenerConversacionPorId(idConversacion);
  if (!conversacion || conversacion.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const etapa = conversacion.etapa_id
    ? await obtenerEtapa(conversacion.etapa_id)
    : null;

  const productos_interes = await listarInteresDeConversacion(idConversacion);
  const llamadas = await listarLlamadasDeConversacion(idConversacion);
  const ultimos_mensajes = await obtenerHistorialReciente(idConversacion, 50);

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
