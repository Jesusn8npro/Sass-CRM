"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

/**
 * Server Action: registro de nuevo usuario.
 *
 * Flujos posibles según config de Supabase Auth:
 *  1. Si "Confirm email" está OFF → la cuenta se crea + sesión activa → redirige a /app
 *  2. Si "Confirm email" está ON  → la cuenta se crea pendiente, manda mail
 *     de confirmación → mostramos mensaje "revisá tu email"
 */
export async function registrarse(formData: FormData): Promise<
  | { error: string }
  | { ok: true; necesitaConfirmacion: boolean }
  | undefined
> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre: nombre || undefined },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ya existe una cuenta con ese email. Probá iniciar sesión." };
    }
    return { error: error.message };
  }

  // Si Supabase devuelve session, ya está logueado.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/app");
  }

  // Necesita confirmar email primero.
  return { ok: true, necesitaConfirmacion: true };
}
