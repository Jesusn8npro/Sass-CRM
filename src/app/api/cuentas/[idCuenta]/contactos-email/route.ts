import { NextResponse, type NextRequest } from "next/server";
import {
  borrarContactoEmail,
  listarContactosEmail,
  obtenerCuenta,
} from "@/lib/baseDatos";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

function validarId(ic: string): number | null {
  const id = Number(ic);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function escapeCSV(s: string | null | undefined): string {
  const v = s ?? "";
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const contactos = listarContactosEmail(id);

  // Si piden ?formato=csv, devolvemos un CSV descargable.
  const formato = req.nextUrl.searchParams.get("formato");
  if (formato === "csv") {
    const lineas: string[] = [
      "email,nombre_contacto,telefono,capturado_en",
    ];
    for (const c of contactos) {
      const fecha = new Date(c.capturado_en * 1000).toISOString();
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
        "Content-Disposition": `attachment; filename="contactos_email_cuenta_${id}.csv"`,
      },
    });
  }

  return NextResponse.json({ contactos });
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = validarId(idCuenta);
  if (id === null) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const idContacto = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(idContacto) || idContacto <= 0) {
    return NextResponse.json(
      { error: "Falta ?id=<id_contacto>" },
      { status: 400 },
    );
  }
  borrarContactoEmail(idContacto);
  return NextResponse.json({ ok: true });
}
