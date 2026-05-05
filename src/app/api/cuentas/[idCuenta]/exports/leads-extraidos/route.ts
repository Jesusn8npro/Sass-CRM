import { NextResponse, type NextRequest } from "next/server";
import { listarLeadsParaExport } from "@/lib/baseDatos";
import { verificarAccesoCuenta } from "@/lib/auth/sesion";
import { verificarRateLimit } from "@/lib/auth/rateLimit";
import {
  HARDCAP_FILAS,
  construirCSV,
  headersCSV,
  nombreArchivo,
} from "@/lib/csvExport";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
  const { idCuenta } = await params;
  const acceso = await verificarAccesoCuenta(idCuenta);
  if (acceso instanceof NextResponse) return acceso;
  const { auth } = acceso;

  const limite = verificarRateLimit(`${auth.id}:export`, 10, 60);
  if (limite) return limite;

  // Pedimos hardcap+1 para detectar truncado real.
  const leads = await listarLeadsParaExport(idCuenta, HARDCAP_FILAS + 1);
  const truncado = leads.length > HARDCAP_FILAS;
  const filas = truncado ? leads.slice(0, HARDCAP_FILAS) : leads;

  const csv = construirCSV(
    [
      "nombre",
      "telefono",
      "email",
      "web",
      "ciudad",
      "categoria",
      "fecha_extraccion",
    ],
    filas.map((l) => [
      l.nombre,
      l.telefono,
      l.email,
      l.sitio_web,
      l.direccion,
      l.categoria,
      l.creado_en,
    ]),
  );

  return new NextResponse(csv, {
    headers: headersCSV(nombreArchivo("leads", idCuenta), truncado),
  });
}
