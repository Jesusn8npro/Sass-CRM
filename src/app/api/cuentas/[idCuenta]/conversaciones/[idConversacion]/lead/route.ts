import { NextResponse, type NextRequest } from "next/server";
import {
  actualizarLead,
  obtenerConversacionPorId,
  obtenerCuenta,
  type EstadoLead,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idConversacion: string }>;
}

const ESTADOS_VALIDOS: EstadoLead[] = [
  "nuevo",
  "contactado",
  "calificado",
  "interesado",
  "negociacion",
  "cerrado",
  "perdido",
];

/** PATCH /api/cuentas/[idCuenta]/conversaciones/[idConversacion]/lead
 *
 * Permite al operador editar manualmente desde el panel:
 *   - estado_lead (Nuevo/Calificado/Interesado/...)
 *   - lead_score (0-100)
 *   - paso_actual (free-form)
 *   - nombre del cliente
 *   - datos capturados (merge — solo los campos que mande)
 */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idConversacion } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const conv = await obtenerConversacionPorId(idConversacion);
  if (!conv || conv.cuenta_id !== idCuenta) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  let payload: {
    estado_lead?: unknown;
    lead_score?: unknown;
    paso_actual?: unknown;
    nombre?: unknown;
    datos_capturados_merge?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cambios: Parameters<typeof actualizarLead>[1] = {};

  if (typeof payload.estado_lead === "string") {
    const v = payload.estado_lead.toLowerCase().trim();
    if (ESTADOS_VALIDOS.includes(v as EstadoLead)) {
      cambios.estado_lead = v as EstadoLead;
    }
  }
  if (typeof payload.lead_score === "number" && Number.isFinite(payload.lead_score)) {
    cambios.lead_score = payload.lead_score;
  }
  if (typeof payload.paso_actual === "string") {
    cambios.paso_actual = payload.paso_actual.trim().slice(0, 60);
  }
  if (typeof payload.nombre === "string") {
    const n = payload.nombre.trim().slice(0, 80);
    if (n) cambios.nombre = n;
  }
  if (
    payload.datos_capturados_merge &&
    typeof payload.datos_capturados_merge === "object"
  ) {
    cambios.datos_capturados_merge = payload.datos_capturados_merge as Parameters<
      typeof actualizarLead
    >[1]["datos_capturados_merge"];
  }

  const actualizada = await actualizarLead(idConversacion, cambios);
  return NextResponse.json({ conversacion: actualizada });
}
