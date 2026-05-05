import { NextResponse, type NextRequest } from "next/server";
import {
  listarContactosEmailParaExport,
  listarContactosTelefonoParaExport,
} from "@/lib/baseDatos";
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

  // Tiramos el cap a cada lado y mezclamos. Si la suma rebasa, cortamos
  // y marcamos truncado.
  const [emails, tels] = await Promise.all([
    listarContactosEmailParaExport(idCuenta, HARDCAP_FILAS + 1),
    listarContactosTelefonoParaExport(idCuenta, HARDCAP_FILAS + 1),
  ]);

  type Fila = {
    tipo: "email" | "telefono";
    valor: string;
    conversacion_id: string | null;
    capturado_en: string;
  };
  const todas: Fila[] = [
    ...emails.map((e) => ({
      tipo: "email" as const,
      valor: e.email,
      conversacion_id: e.conversacion_id,
      capturado_en: e.capturado_en,
    })),
    ...tels.map((t) => ({
      tipo: "telefono" as const,
      valor: t.telefono,
      conversacion_id: t.conversacion_id,
      capturado_en: t.capturado_en,
    })),
  ];
  todas.sort((a, b) => b.capturado_en.localeCompare(a.capturado_en));

  const truncado = todas.length > HARDCAP_FILAS;
  const filas = truncado ? todas.slice(0, HARDCAP_FILAS) : todas;

  const csv = construirCSV(
    ["tipo", "valor", "conversacion_id", "capturado_en"],
    filas.map((f) => [f.tipo, f.valor, f.conversacion_id, f.capturado_en]),
  );

  return new NextResponse(csv, {
    headers: headersCSV(nombreArchivo("contactos", idCuenta), truncado),
  });
}
