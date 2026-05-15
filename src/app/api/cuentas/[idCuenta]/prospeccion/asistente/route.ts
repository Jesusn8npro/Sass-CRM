import { NextResponse, type NextRequest } from "next/server";
import { verificarAccesoCuenta, parsearJSON } from "@/lib/auth/sesion";
import { resolverCredencialesVapi } from "@/lib/vapi-credenciales";
import { obtenerAssistant } from "@/lib/vapi";

export const dynamic = "force-dynamic";

const VAPI_API = "https://api.vapi.ai";

function obtenerAssistantId(cuenta: { vapi_assistant_id?: string | null }): string | null {
  return (
    process.env.OUTREACH_ASSISTANT_ID?.trim() ||
    cuenta.vapi_assistant_id?.trim() ||
    null
  );
}

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export interface CampoExtraccion {
  nombre: string;
  descripcion: string;
  tipo: "string" | "boolean" | "number";
  opciones?: string[];
}

function construirSchema(campos: CampoExtraccion[]): Record<string, unknown> | null {
  if (campos.length === 0) return null;
  const properties: Record<string, unknown> = {};
  for (const c of campos) {
    const def: Record<string, unknown> = { type: c.tipo, description: c.descripcion };
    if (c.opciones && c.opciones.length > 0) def.enum = c.opciones;
    properties[c.nombre] = def;
  }
  return { type: "object", properties };
}

function parsearCampos(schema: unknown): CampoExtraccion[] {
  if (!schema || typeof schema !== "object") return [];
  const props = (schema as Record<string, unknown>).properties;
  if (!props || typeof props !== "object") return [];
  return Object.entries(props as Record<string, unknown>).map(([nombre, def]) => {
    const d = (def ?? {}) as Record<string, unknown>;
    return {
      nombre,
      descripcion: typeof d.description === "string" ? d.description : "",
      tipo: (["string", "boolean", "number"].includes(d.type as string) ? d.type : "string") as CampoExtraccion["tipo"],
      opciones: Array.isArray(d.enum) ? (d.enum as string[]) : undefined,
    };
  });
}

/** GET — devuelve la configuración actual del asistente de outreach desde Vapi */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;

  const cred = resolverCredencialesVapi(cuenta);
  if (!cred.apiKey) {
    return NextResponse.json({ error: "Falta VAPI_API_KEY" }, { status: 400 });
  }

  const assistantId = obtenerAssistantId(cuenta);
  if (!assistantId) {
    return NextResponse.json({ error: "No hay assistant de outreach configurado. Seteá OUTREACH_ASSISTANT_ID." }, { status: 404 });
  }

  try {
    const assistant = await obtenerAssistant(cred.apiKey, assistantId);
    const systemPrompt = assistant.model?.messages?.find(m => m.role === "system")?.content ?? "";
    const campos = parsearCampos(assistant.analysisPlan?.structuredDataSchema);
    return NextResponse.json({
      id: assistant.id,
      nombre: assistant.name ?? "",
      primerMensaje: assistant.firstMessage ?? "",
      systemPrompt,
      modelo: assistant.model?.model ?? "gpt-4o-mini",
      voz: assistant.voice ?? null,
      serverUrl: assistant.serverUrl ?? "",
      campos,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** PATCH — actualiza el asistente de outreach en Vapi */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { cuenta } = acceso;

  const cred = resolverCredencialesVapi(cuenta);
  if (!cred.apiKey) {
    return NextResponse.json({ error: "Falta VAPI_API_KEY" }, { status: 400 });
  }

  const assistantId = obtenerAssistantId(cuenta);
  if (!assistantId) {
    return NextResponse.json({ error: "No hay assistant de outreach configurado." }, { status: 404 });
  }

  const body = await parsearJSON<{
    primerMensaje?: string;
    systemPrompt?: string;
    modelo?: string;
    nombre?: string;
    serverUrl?: string;
    campos?: CampoExtraccion[];
  }>(req);
  if (body instanceof NextResponse) return body;

  const patch: Record<string, unknown> = {};

  if (typeof body.nombre === "string") patch.name = body.nombre.trim();
  if (typeof body.primerMensaje === "string") patch.firstMessage = body.primerMensaje.trim();
  if (typeof body.serverUrl === "string") patch.serverUrl = body.serverUrl.trim();

  if (Array.isArray(body.campos)) {
    const schema = construirSchema(body.campos);
    patch.analysisPlan = schema ? { structuredDataSchema: schema } : {};
  }

  // Para actualizar el systemPrompt hay que mandar el model completo
  if (typeof body.systemPrompt === "string" || typeof body.modelo === "string") {
    const actual = await obtenerAssistant(cred.apiKey, assistantId);
    const mensajesActuales = actual.model?.messages ?? [];
    const nuevosMensajes = mensajesActuales.map(m =>
      m.role === "system"
        ? { ...m, content: body.systemPrompt ?? m.content }
        : m
    );
    if (!nuevosMensajes.find(m => m.role === "system") && body.systemPrompt) {
      nuevosMensajes.unshift({ role: "system", content: body.systemPrompt });
    }
    patch.model = {
      provider: actual.model?.provider ?? "openai",
      model: body.modelo ?? actual.model?.model ?? "gpt-4o-mini",
      messages: nuevosMensajes,
    };
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const res = await fetch(`${VAPI_API}/assistant/${encodeURIComponent(assistantId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${cred.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      return NextResponse.json({ error: `Vapi ${res.status}: ${detalle.slice(0, 300)}` }, { status: 502 });
    }
    const actualizado = await res.json() as Record<string, unknown>;
    const systemPrompt = (actualizado.model as { messages?: Array<{ role: string; content: string }> })
      ?.messages?.find(m => m.role === "system")?.content ?? "";
    const campos = parsearCampos(
      (actualizado.analysisPlan as { structuredDataSchema?: unknown } | undefined)?.structuredDataSchema
    );
    return NextResponse.json({ ok: true, id: actualizado.id, systemPrompt, campos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
