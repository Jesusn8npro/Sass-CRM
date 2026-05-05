import { NextResponse, type NextRequest } from "next/server";
import { listarConversacionesParaExport } from "@/lib/baseDatos";
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

  const convs = await listarConversacionesParaExport(idCuenta, HARDCAP_FILAS + 1);
  const truncado = convs.length > HARDCAP_FILAS;
  const filas = truncado ? convs.slice(0, HARDCAP_FILAS) : convs;

  const csv = construirCSV(
    [
      "telefono",
      "nombre",
      "modo",
      "estado_lead",
      "lead_score",
      "etapa_actual",
      "ultimo_mensaje_en",
      "total_mensajes",
      "datos_capturados",
      "creada_en",
    ],
    filas.map((c) => [
      c.telefono,
      c.nombre,
      c.modo,
      c.estado_lead,
      c.lead_score,
      c.paso_actual,
      c.ultimo_mensaje_en,
      c.total_mensajes,
      JSON.stringify(c.datos_capturados ?? {}),
      c.creada_en,
    ]),
  );

  return new NextResponse(csv, {
    headers: headersCSV(nombreArchivo("conversaciones", idCuenta), truncado),
  });
}
