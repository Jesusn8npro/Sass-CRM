import { NextResponse, type NextRequest } from "next/server";
import { crearSolicitudAcademia } from "@/lib/db/solicitudesAcademia";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/academia/lead
 *
 * Webhook PÚBLICO que llama Academia Vallenata Online cuando un lead del chat
 * dejó su WhatsApp y no completó una compra (seguimiento de abandono).
 * Valida el header `x-webhook-secret` contra ACADEMIA_WEBHOOK_SECRET y guarda
 * la solicitud como "pendiente" para que el admin la dispare desde el panel.
 *
 * Está en la allowlist de webhooks públicos (src/proxy.ts).
 */
export async function POST(req: NextRequest) {
  const esperado = process.env.ACADEMIA_WEBHOOK_SECRET || "";
  const recibido = req.headers.get("x-webhook-secret") || "";
  if (!esperado || recibido !== esperado) {
    log.warn({}, "[academia:webhook] secret inválido");
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const lead = body?.lead ?? {};
  const whatsapp = String(lead.whatsapp || "").trim();
  if (!whatsapp) {
    return NextResponse.json({ error: "falta_whatsapp" }, { status: 400 });
  }

  try {
    const solicitud = await crearSolicitudAcademia({
      evento: body?.evento ?? "seguimiento_lead",
      nombre: lead.nombre ?? null,
      whatsapp,
      email: lead.email ?? null,
      ciudad: lead.ciudad ?? null,
      que_quiere_aprender: lead.que_quiere_aprender ?? null,
      nivel_acordeon: lead.nivel_acordeon ?? null,
      productos_consultados: Array.isArray(lead.productos_consultados) ? lead.productos_consultados : [],
      nivel_interes: typeof lead.nivel_interes === "number" ? lead.nivel_interes : null,
      pagina_origen: lead.pagina_origen ?? null,
      mensaje_sugerido: body?.sugerencia_mensaje ?? null,
      payload: body,
    });
    return NextResponse.json({ ok: true, id: solicitud.id });
  } catch (e) {
    log.error({ err: String(e) }, "[academia:webhook] error guardando solicitud");
    return NextResponse.json({ error: "error_interno" }, { status: 500 });
  }
}
