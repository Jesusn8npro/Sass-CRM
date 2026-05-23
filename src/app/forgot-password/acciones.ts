"use server";

import { crearClienteServidor } from "@/lib/supabase/cliente-servidor";

export async function solicitarResetPassword(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "El email es obligatorio" };

  const supabase = await crearClienteServidor();
  const baseUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/api/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };
  return { ok: true };
}
