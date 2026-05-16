import { NextResponse, type NextRequest } from "next/server";
import { parsearJSON, verificarAccesoCuenta } from "@/lib/auth/sesion";
import { agregarMiembro, eliminarMiembro, listarMiembros } from "@/lib/db/cuentaMiembros";
import { db } from "@/lib/db/cliente";

export const dynamic = "force-dynamic";
interface Ctx { params: Promise<{ idCuenta: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;

  const miembros = await listarMiembros(idCuenta);
  return NextResponse.json({ miembros });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (acceso.esMiembro) {
    return NextResponse.json({ error: "Solo el owner puede gestionar el equipo" }, { status: 403 });
  }

  const body = await parsearJSON<{ email?: unknown; rol?: unknown }>(req);
  if (body instanceof NextResponse) return body;

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const rol = body.rol === "admin" ? "admin" : "agente";
  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  // Buscar usuario por email
  const { data: usuarioData } = await db()
    .from("usuarios")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  if (!usuarioData) {
    return NextResponse.json(
      { error: "No existe un usuario con ese email. El agente debe registrarse primero." },
      { status: 404 },
    );
  }
  if (usuarioData.id === acceso.cuenta.usuario_id) {
    return NextResponse.json({ error: "No podés agregarte a vos mismo como miembro" }, { status: 400 });
  }

  const miembro = await agregarMiembro(idCuenta, usuarioData.id, rol, acceso.auth.id);
  return NextResponse.json({ ok: true, miembro });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  if (acceso.esMiembro) {
    return NextResponse.json({ error: "Solo el owner puede gestionar el equipo" }, { status: 403 });
  }

  const body = await parsearJSON<{ usuarioId?: unknown }>(req);
  if (body instanceof NextResponse) return body;
  const usuarioId = typeof body.usuarioId === "string" ? body.usuarioId : "";
  if (!usuarioId) return NextResponse.json({ error: "usuarioId requerido" }, { status: 400 });

  await eliminarMiembro(idCuenta, usuarioId);
  return NextResponse.json({ ok: true });
}
