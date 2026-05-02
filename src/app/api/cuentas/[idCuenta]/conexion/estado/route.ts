import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { obtenerCuenta } from "@/lib/baseDatos";
import { calcularBotVivo } from "@/lib/latidoBot";
import { requerirSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

export async function GET(_req: NextRequest, { params }: Contexto) {
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

  const bot_vivo = calcularBotVivo(cuenta);

  const debeMostrarQR =
    !!cuenta.cadena_qr &&
    (cuenta.estado === "qr" || cuenta.estado === "conectando");

  if (debeMostrarQR && cuenta.cadena_qr) {
    const qr_png = await QRCode.toDataURL(cuenta.cadena_qr, {
      width: 320,
      margin: 2,
      color: { dark: "#fafafa", light: "#0a0a0a" },
    });
    return NextResponse.json({
      estado: "qr",
      qr_png,
      telefono: cuenta.telefono,
      bot_vivo,
      ultimo_heartbeat: cuenta.ultimo_heartbeat,
    });
  }

  return NextResponse.json({
    estado: cuenta.estado,
    telefono: cuenta.telefono,
    bot_vivo,
    ultimo_heartbeat: cuenta.ultimo_heartbeat,
  });
}
