"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para componentes del navegador (Client Components).
 * Lee la sesión desde cookies que setea el middleware/server actions.
 *
 * Usa la PUBLISHABLE KEY (segura para exponer al cliente, las RLS policies
 * controlan qué puede leer/escribir cada usuario autenticado).
 */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
