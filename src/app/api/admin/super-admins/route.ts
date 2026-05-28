import { NextResponse, type NextRequest } from "next/server";
import {
  crearSuperAdminAdmin,
  listarSuperAdminsAdmin,
  obtenerSuperAdminPorEmail,
  registrarAccionAdmin,
} from "@/lib/baseDatos";
import { parsearJSON, requerirAdmin } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

/** GET — Lista todos los super-admins (activos e inactivos). */
export async function GET() {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const items = await listarSuperAdminsAdmin();
  return NextResponse.json({ items });
}

interface CuerpoNuevo {
  email: string;
  telefono_whatsapp: string;
  nombre?: string | null;
}

/** POST — Crea un super-admin nuevo. */
export async function POST(req: NextRequest) {
  const auth = await requerirAdmin();
  if (auth instanceof NextResponse) return auth;
  const cuerpo = await parsearJSON<CuerpoNuevo>(req);
  if (cuerpo instanceof NextResponse) return cuerpo;

  if (!cuerpo.email || !cuerpo.telefono_whatsapp) {
    return NextResponse.json(
      { error: "email y telefono_whatsapp son obligatorios" },
      { status: 400 },
    );
  }

  try {
    const creado = await crearSuperAdminAdmin({
      email: cuerpo.email,
      telefonoWhatsapp: cuerpo.telefono_whatsapp,
      nombre: cuerpo.nombre ?? null,
    });
    const sa = await obtenerSuperAdminPorEmail(auth.email);
    if (sa) {
      void registrarAccionAdmin({
        superAdminId: sa.id,
        origen: "panel",
        accion: "super_admin_crear",
        payload: { id_creado: creado.id, email: creado.email },
      });
    }
    return NextResponse.json({ ok: true, item: creado });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Email/telefono duplicado → Postgres lanza 23505. Mensaje amigable.
    if (msg.includes("23505") || msg.toLowerCase().includes("duplicate")) {
      return NextResponse.json(
        { error: "Ya existe un super-admin con ese email o teléfono" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
