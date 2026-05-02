import { NextResponse, type NextRequest } from "next/server";
import {
  borrarContactoEmail,
  listarContactosEmail,
  obtenerCuenta,
} from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

function escapeCSV(s: string | null | undefined): string {
  const v = s ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const contactos = await listarContactosEmail(idCuenta);

  // Si piden ?formato=csv, devolvemos un CSV descargable.
  const formato = req.nextUrl.searchParams.get("formato");
  if (formato === "csv") {
    const lineas: string[] = [
      "email,nombre_contacto,telefono,capturado_en",
    ];
    for (const c of contactos) {
      const fecha = new Date(c.capturado_en).toISOString();
      lineas.push(
        [
          escapeCSV(c.email),
          escapeCSV(c.nombre_contacto),
          escapeCSV(c.telefono),
          escapeCSV(fecha),
        ].join(","),
      );
    }
    const csv = lineas.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contactos_email_cuenta_${idCuenta}.csv"`,
      },
    });
  }

  return NextResponse.json({ contactos });
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  if (!idCuenta) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const idContacto = req.nextUrl.searchParams.get("id");
  if (!idContacto) {
    return NextResponse.json(
      { error: "Falta ?id=<id_contacto>" },
      { status: 400 },
    );
  }
  await borrarContactoEmail(idContacto);
  return NextResponse.json({ ok: true });
}
