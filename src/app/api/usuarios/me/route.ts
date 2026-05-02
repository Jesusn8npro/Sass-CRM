import { NextResponse, type NextRequest } from "next/server";
import { requerirSesion } from "@/lib/auth/sesion";
import {
  actualizarNombreUsuario,
  contarCuentasDeUsuario,
  obtenerUsuarioApp,
} from "@/lib/baseDatos";
import { obtenerPlan } from "@/lib/planes";

export const dynamic = "force-dynamic";

/**
 * GET /api/usuarios/me — devuelve perfil + plan + uso del usuario logueado.
 *
 * Respuesta:
 * {
 *   usuario: { id, email, nombre, plan, rol, creado_en },
 *   plan: { id, nombre, precio_usd_mes, limite_cuentas, ... },
 *   uso: { cuentas: number, limite_cuentas: number, lleno: boolean }
 * }
 */
export async function GET() {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const usuario = await obtenerUsuarioApp(auth.id);
  if (!usuario) {
    return NextResponse.json(
      { error: "Usuario no encontrado en public.usuarios (¿faltó trigger?)" },
      { status: 404 },
    );
  }

  const plan = obtenerPlan(usuario.plan);
  const cuentasUsadas = await contarCuentasDeUsuario(auth.id);

  return NextResponse.json({
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      plan: usuario.plan,
      rol: usuario.rol,
      creado_en: usuario.creado_en,
    },
    plan: {
      id: plan.id,
      nombre: plan.nombre,
      precio_usd_mes: plan.precio_usd_mes,
      limite_cuentas: Number.isFinite(plan.limite_cuentas)
        ? plan.limite_cuentas
        : null,
      limite_mensajes_mes: Number.isFinite(plan.limite_mensajes_mes)
        ? plan.limite_mensajes_mes
        : null,
      permite_voz_clonada: plan.permite_voz_clonada,
      permite_llamadas_vapi: plan.permite_llamadas_vapi,
      permite_multi_modelo: plan.permite_multi_modelo,
      resumen: plan.resumen,
      beneficios: plan.beneficios,
    },
    uso: {
      cuentas: cuentasUsadas,
      limite_cuentas: Number.isFinite(plan.limite_cuentas)
        ? plan.limite_cuentas
        : null,
      lleno: cuentasUsadas >= plan.limite_cuentas,
    },
  });
}

/**
 * PATCH /api/usuarios/me — actualiza nombre del usuario.
 * Body: { nombre: string }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  let payload: { nombre?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof payload.nombre !== "string") {
    return NextResponse.json(
      { error: "El campo 'nombre' es obligatorio" },
      { status: 400 },
    );
  }
  const usuario = await actualizarNombreUsuario(auth.id, payload.nombre);
  return NextResponse.json({ usuario });
}
