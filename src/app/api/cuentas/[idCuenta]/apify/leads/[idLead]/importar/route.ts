import { NextResponse, type NextRequest } from "next/server";
import {
  guardarContactosEmail,
  guardarContactosTelefono,
  marcarLeadImportado,
  obtenerCuenta,
  obtenerLead,
  obtenerOCrearConversacion,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string; idLead: string }>;
}

/**
 * POST /api/cuentas/[idCuenta]/apify/leads/[idLead]/importar
 *
 * Toma un lead de la bandeja y lo agrega al CRM:
 *  - crea conversacion (o reusa si ya existe por telefono)
 *  - guarda email/telefono en sus tablas correspondientes
 *  - marca el lead como importado para que no aparezca como "pendiente"
 *
 * Idempotente: si el lead ya esta importado, devuelve el conv_id viejo.
 */
export async function POST(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta, idLead } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json(
      { error: "cuenta_no_encontrada" },
      { status: 404 },
    );
  }

  const lead = await obtenerLead(idLead);
  if (!lead || lead.cuenta_id !== idCuenta) {
    return NextResponse.json({ error: "lead_no_encontrado" }, { status: 404 });
  }
  if (lead.importado && lead.conversacion_id) {
    return NextResponse.json({
      ok: true,
      ya_importado: true,
      conversacion_id: lead.conversacion_id,
    });
  }

  // Necesitamos algun identificador para crear la conversacion. Si no
  // hay telefono, usamos un placeholder derivado del email o un random.
  const telefono =
    lead.telefono ||
    (lead.email
      ? `mail_${lead.email.split("@")[0]}_${idLead.slice(0, 6)}`
      : `lead_${idLead.slice(0, 8)}`);

  const conv = await obtenerOCrearConversacion(
    idCuenta,
    telefono,
    lead.nombre,
    null,
  );

  if (lead.email) {
    await guardarContactosEmail(idCuenta, conv.id, [lead.email]);
  }
  if (lead.telefono) {
    await guardarContactosTelefono(
      idCuenta,
      conv.id,
      [lead.telefono],
      telefono,
    );
  }

  await marcarLeadImportado(idLead, conv.id);

  return NextResponse.json({
    ok: true,
    conversacion_id: conv.id,
  });
}
