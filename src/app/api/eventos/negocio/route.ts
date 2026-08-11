import { NextResponse, type NextRequest } from "next/server";
import {
  obtenerCuentaPorTokenEventos,
  registrarEventoNegocio,
} from "@/lib/db/eventosNegocio";
import { obtenerCuenta } from "@/lib/db";
import { enviarAlertaOperador } from "@/lib/operadorPrivado";
import { formatearEventoParaOperador } from "@/lib/eventosNegocio";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lo llama el sitio del cliente o un trigger de su Postgres (pg_net), siempre
// cross-origin. La seguridad la da el token por cuenta, no el origen.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-evento-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Deja pasar solo valores planos: nada de objetos anidados ni payloads enormes. */
function normalizarDatos(entrada: unknown): Record<string, unknown> {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return {};
  const salida: Record<string, unknown> = {};
  let n = 0;
  for (const [clave, valor] of Object.entries(entrada as Record<string, unknown>)) {
    if (n >= 25) break;
    if (valor === null || valor === undefined) continue;
    if (typeof valor === "object") continue;
    salida[clave.slice(0, 60)] = typeof valor === "string" ? valor.slice(0, 300) : valor;
    n++;
  }
  return salida;
}

/**
 * POST /api/eventos/negocio  (PÚBLICO)
 *
 * Disparadores de negocio → alerta de WhatsApp al operador privado de la cuenta.
 * Se autentica con `token_eventos` (header `x-evento-token` o body.token).
 * Está en la allowlist de webhooks (proxy.ts).
 *
 * Body:
 *   { tipo: "usuario_registrado" | "compra_iniciada" | ... ,
 *     titulo?: string,                 // sobreescribe el encabezado
 *     datos?: { nombre, email, ... } }
 *
 * Siempre responde 200 si el token es válido, aunque no se notifique: quien
 * dispara (un trigger de Postgres) no debe reintentar ni fallar por esto.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400, headers: CORS });
  }

  const token = String(
    req.headers.get("x-evento-token") || (body?.token as string) || "",
  ).trim();
  const cuentaId = await obtenerCuentaPorTokenEventos(token);
  if (!cuentaId) {
    return NextResponse.json({ error: "token_invalido" }, { status: 401, headers: CORS });
  }

  // Un trigger mal escrito (o un bucle de updates) puede disparar miles de
  // eventos. El tope protege el número de WhatsApp de un baneo por flood.
  const limite = verificarRateLimit(`${cuentaId}:eventos-negocio`, 60, 60);
  if (limite) return limite;

  const tipo = String(body?.tipo || "evento").trim().slice(0, 60) || "evento";
  const titulo = body?.titulo ? String(body.titulo).slice(0, 200) : null;
  const datos = normalizarDatos(body?.datos ?? body);

  const cuenta = await obtenerCuenta(cuentaId);
  if (!cuenta) {
    return NextResponse.json({ error: "cuenta_inexistente" }, { status: 404, headers: CORS });
  }

  // Interruptor maestro: permite cortar el ruido desde el panel sin tener que
  // ir a desarmar los triggers en la base del negocio.
  const activos = (cuenta as { eventos_negocio_activos?: boolean }).eventos_negocio_activos;
  if (activos === false) {
    await registrarEventoNegocio({
      cuentaId, tipo, titulo, datos,
      notificado: false, motivo: "eventos_desactivados",
    });
    return NextResponse.json({ ok: true, notificado: false, motivo: "eventos_desactivados" }, { headers: CORS });
  }

  const mensaje = formatearEventoParaOperador({ tipo, titulo, datos });
  const notificado = await enviarAlertaOperador(cuenta, mensaje);

  // enviarAlertaOperador devuelve false sin decir por qué; el motivo más común
  // es que falte el teléfono o esté apagado el toggle de alertas. Lo dejamos
  // escrito para que el panel pueda explicar "llegó pero no se envió".
  const motivo = notificado
    ? null
    : !cuenta.telefono_operador_privado
      ? "sin_telefono_operador"
      : !cuenta.operador_privado_alertas
        ? "alertas_desactivadas"
        : "error_encolando";

  await registrarEventoNegocio({ cuentaId, tipo, titulo, datos, notificado, motivo });

  if (!notificado) {
    log.warn({ cuentaId, tipo, motivo }, "[eventos:negocio] evento recibido pero no notificado");
  }

  return NextResponse.json({ ok: true, notificado, motivo }, { headers: CORS });
}
