"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

export async function actualizarPassword(
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (!password || password.length < 8)
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  if (password !== confirmacion)
    return { error: "Las contraseñas no coinciden" };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };
  redirect("/app");
}
