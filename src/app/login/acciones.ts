"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Server Action: login con email + password.
 * Si va bien, redirige a /app (o a la ruta `siguiente` que vino del query).
 * Si falla, devuelve { error } para mostrar en el form.
 */
export async function iniciarSesion(formData: FormData): Promise<
  | { error: string }
  | undefined
> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const siguiente = String(formData.get("siguiente") ?? "/app");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login")) {
      return { error: "Email o contraseña incorrectos" };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(siguiente.startsWith("/") ? siguiente : "/app");
}
