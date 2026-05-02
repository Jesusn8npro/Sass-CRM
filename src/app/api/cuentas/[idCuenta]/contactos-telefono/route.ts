import { NextResponse, type NextRequest } from "next/server";
import {
  borrarContactoTelefono,
  listarContactosTelefono,
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

  const contactos = await listarContactosTelefono(idCuenta);
  const formato = req.nextUrl.searchParams.get("formato");
  if (formato === "csv") {
    const lineas: string[] = [
      "telefono,nombre_contacto,telefono_conversacion,capturado_en",
    ];
    for (const c of contactos) {
      const fecha = new Date(c.capturado_en).toISOString();
      lineas.push(
        [
          escapeCSV(c.telefono),
          escapeCSV(c.nombre_contacto),
          escapeCSV(c.telefono_conv),
          escapeCSV(fecha),
        ].join(","),
      );
    }
    return new NextResponse(lineas.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contactos_telefono_cuenta_${idCuenta}.csv"`,
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
  await borrarContactoTelefono(idContacto);
  return NextResponse.json({ ok: true });
}
