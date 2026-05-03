import { db, lanzar } from "./cliente";
import type { AssistantVapi } from "./tipos";

export async function listarAssistantsDeCuenta(
  cuentaId: string,
): Promise<AssistantVapi[]> {
  const { data, error } = await db()
    .from("assistants_vapi")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .order("es_default", { ascending: false })
    .order("creado_en", { ascending: true });
  if (error) lanzar(error, "listarAssistantsDeCuenta");
  return (data ?? []) as AssistantVapi[];
}

export async function obtenerAssistantLocal(
  id: string,
): Promise<AssistantVapi | null> {
  const { data, error } = await db()
    .from("assistants_vapi")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) lanzar(error, "obtenerAssistantLocal");
  return (data as AssistantVapi) ?? null;
}

export async function obtenerAssistantDefault(
  cuentaId: string,
): Promise<AssistantVapi | null> {
  const { data, error } = await db()
    .from("assistants_vapi")
    .select("*")
    .eq("cuenta_id", cuentaId)
    .eq("es_default", true)
    .maybeSingle();
  if (error) lanzar(error, "obtenerAssistantDefault");
  return (data as AssistantVapi) ?? null;
}

export async function crearAssistantLocal(
  cuentaId: string,
  datos: {
    nombre: string;
    prompt_extra?: string;
    primer_mensaje?: string;
    voz_elevenlabs?: string | null;
    modelo?: string;
    max_segundos?: number;
    grabar?: boolean;
    es_default?: boolean;
  },
): Promise<AssistantVapi> {
  // Si se marca como default, primero quitamos default de los demás
  // (el índice único parcial nos protege pero hacemos limpio).
  if (datos.es_default) {
    await db()
      .from("assistants_vapi")
      .update({ es_default: false })
      .eq("cuenta_id", cuentaId)
      .eq("es_default", true);
  }
  const { data, error } = await db()
    .from("assistants_vapi")
    .insert({
      cuenta_id: cuentaId,
      nombre: datos.nombre.trim(),
      prompt_extra: datos.prompt_extra ?? "",
      primer_mensaje: datos.primer_mensaje ?? "",
      voz_elevenlabs: datos.voz_elevenlabs ?? null,
      modelo: datos.modelo ?? "gpt-4o-mini",
      max_segundos: datos.max_segundos ?? 600,
      grabar: datos.grabar ?? true,
      es_default: datos.es_default ?? false,
    })
    .select()
    .single();
  if (error) lanzar(error, "crearAssistantLocal");
  return data as AssistantVapi;
}

export async function actualizarAssistantLocal(
  id: string,
  cambios: Partial<{
    nombre: string;
    vapi_assistant_id: string | null;
    prompt_extra: string;
    primer_mensaje: string;
    voz_elevenlabs: string | null;
    modelo: string;
    max_segundos: number;
    grabar: boolean;
    es_default: boolean;
    esta_activo: boolean;
    sincronizado_en: string | null;
  }>,
): Promise<AssistantVapi | null> {
  if (cambios.es_default === true) {
    const { data: actual } = await db()
      .from("assistants_vapi")
      .select("cuenta_id")
      .eq("id", id)
      .maybeSingle();
    if (actual) {
      await db()
        .from("assistants_vapi")
        .update({ es_default: false })
        .eq("cuenta_id", (actual as { cuenta_id: string }).cuenta_id)
        .neq("id", id);
    }
  }
  const { data, error } = await db()
    .from("assistants_vapi")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();
  if (error) lanzar(error, "actualizarAssistantLocal");
  return data as AssistantVapi;
}

export async function borrarAssistantLocal(id: string): Promise<void> {
  const { error } = await db().from("assistants_vapi").delete().eq("id", id);
  if (error) lanzar(error, "borrarAssistantLocal");
}
