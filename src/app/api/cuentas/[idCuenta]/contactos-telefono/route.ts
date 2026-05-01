import { NextResponse, type NextRequest } from "next/server";
import {
  borrarContactoTelefono,
  listarContactosTelefono,
  obtenerCuenta,
} from "@/lib/baseDatos";

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
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  if (!obtenerCuenta(id)) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const contactos = listarContactosTelefono(id);
  const formato = req.nextUrl.searchParams.get("formato");
  if (formato === "csv") {
    const lineas: string[] = [
      "telefono,nombre_contacto,telefono_conversacion,capturado_en",
    ];
    for (const c of contactos) {
      const fecha = new Date(c.capturado_en * 1000).toISOString();
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
        "Content-Disposition": `attachment; filename="contactos_telefono_cuenta_${id}.csv"`,
      },
    });
  }

  return NextResponse.json({ contactos });
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const id = Number(idCuenta);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const idContacto = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(idContacto) || idContacto <= 0) {
    return NextResponse.json(
      { error: "Falta ?id=<id_contacto>" },
      { status: 400 },
    );
  }
  borrarContactoTelefono(idContacto);
  return NextResponse.json({ ok: true });
}
