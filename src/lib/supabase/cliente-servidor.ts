import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente Supabase para Server Components y Route Handlers.
 * Lee/setea cookies de sesión a través de la API de Next.js.
 *
 * NOTA: En Server Actions y Route Handlers podemos setear cookies.
 * En Server Components (sin Action), si la sesión expira y hay que
 * refrescarla, el setAll() puede fallar — lo manejamos silencioso para
 * que no rompa el SSR (la sesión se refresca en el siguiente middleware).
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component sin contexto de mutación: ignorar.
            // El middleware refrescará la sesión en la próxima request.
          }
        },
      },
    },
  );
}

/**
 * Cliente Supabase con SERVICE ROLE — bypassea RLS.
 * Solo para operaciones administrativas server-side (ej: el bot que
 * lee/escribe en nombre del sistema, no de un usuario).
 *
 * NUNCA exponer la service_role al cliente. Esta función solo se puede
 * llamar desde código server (route handlers, server actions, scripts).
 */
export function crearClienteAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está definida — no se puede crear cliente admin.",
    );
  }
  // Importamos createClient (no el server con cookies) porque admin
  // no maneja sesión de usuario.
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
