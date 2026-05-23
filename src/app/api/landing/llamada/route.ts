import { NextResponse, type NextRequest } from "next/server";
import { registrarLlamadaLanding } from "@/lib/db/llamadasLanding";

// Rate limit simple: max 20 registros por IP por hora
const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
  }

  let vapiCallId: string;
  try {
    const body = await req.json();
    vapiCallId = body?.vapi_call_id;
    if (!vapiCallId || typeof vapiCallId !== "string") throw new Error();
  } catch {
    return NextResponse.json({ error: "vapi_call_id requerido" }, { status: 400 });
  }

  try {
    const llamada = await registrarLlamadaLanding(vapiCallId, ip);
    return NextResponse.json({ ok: true, id: llamada.id });
  } catch (err) {
    console.error("[landing/llamada] Error registrando llamada:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
