import { redirect } from "next/navigation";
import {
  esUsuarioAdmin,
  obtenerUsuarioActual,
} from "@/lib/auth/sesion";
import {
  listarConversaciones,
  listarCuentas,
  listarEtapas,
  listarProductos,
  obtenerEstadoOnboarding,
} from "@/lib/baseDatos";

/**
 * Entrada al wizard de onboarding. Decide a qué paso ir según estado.
 *
 * Reglas:
 *   - Sin cuentas activas → /onboarding/conectar
 *   - Cuenta sin etapas custom (sólo defaults) → /onboarding/plantilla
 *   - Etapas OK pero <1 producto → /onboarding/productos
 *   - Productos OK pero la cuenta no tiene mensajes entrantes → /onboarding/probar
 *   - Todo OK → /app/cuentas/{id}/conversaciones
 */
export default async function PaginaOnboarding() {
  const auth = await obtenerUsuarioActual();
  if (!auth) redirect("/login?siguiente=/onboarding");

  // El admin no es forzado al wizard — si llega acá lo mandamos a /app
  // donde elige modo admin o crear cuenta WhatsApp como cliente.
  if (await esUsuarioAdmin(auth.id)) {
    redirect("/app");
  }

  const cuentas = await listarCuentas(auth.id);
  if (cuentas.length === 0) redirect("/onboarding/conectar");

  // Tomamos la primera cuenta (creada_en asc). Si el usuario tiene
  // varias el wizard se enfoca en la primera; el resto se gestiona
  // desde el panel normal.
  const cuenta = cuentas[0]!;

  // Si la cuenta aún no está conectada, paso 1 igual.
  if (cuenta.estado !== "conectado") redirect("/onboarding/conectar");

  // Detectar si las etapas son las default (sin paso_id custom de plantilla).
  const etapas = await listarEtapas(cuenta.id);
  const tienePlantillaAplicada = etapas.some(
    (e) => !!e.paso_id && e.paso_id.length > 0,
  );
  if (!tienePlantillaAplicada) redirect("/onboarding/plantilla");

  // Productos cargados.
  const productos = await listarProductos(cuenta.id);
  if (productos.length < 1) redirect("/onboarding/productos");

  // Mensajes entrantes (al menos una conversación con ultimo_mensaje_en).
  const conversaciones = await listarConversaciones(cuenta.id);
  const tieneMensajes = conversaciones.some((c) => !!c.ultimo_mensaje_en);
  if (!tieneMensajes) redirect("/onboarding/probar");

  // Todo OK — marcamos completo y vamos al panel.
  const estado = await obtenerEstadoOnboarding(auth.id);
  if (!estado.completo) {
    // Mejor effort: intentamos persistir, sin bloquear si la migración
    // 09 todavía no corrió.
    const { marcarOnboardingCompleto } = await import("@/lib/baseDatos");
    try {
      await marcarOnboardingCompleto(auth.id);
    } catch {
      /* silencio */
    }
  }
  redirect(`/app/cuentas/${cuenta.id}/conversaciones`);
}
