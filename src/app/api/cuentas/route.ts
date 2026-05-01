import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { crearCuenta, listarCuentas } from "@/lib/baseDatos";
import { arrancarBotEnProceso } from "@/lib/bot/cicloVida";
import { calcularBotVivo } from "@/lib/latidoBot";

export const dynamic = "force-dynamic";

export async function GET() {
  // Fallback: si por algún motivo instrumentation no arrancó el bot,
  // lo arrancamos en la primera request al panel. arrancarBotEnProceso
  // es idempotente: llamadas repetidas no duplican intervals ni sockets.
  if (process.env.BOT_EN_PROCESO !== "0") {
    void arrancarBotEnProceso().catch((err) =>
      console.error("[api/cuentas] fallback arrancar bot:", err),
    );
  }
  const cuentas = listarCuentas();
  const enriquecidas = await Promise.all(
    cuentas.map(async (c) => {
      // Pre-renderizar QR como PNG para cuentas en estado 'qr' o 'conectando'.
      // Así el front no necesita un polling separado para obtener el QR.
      let qr_png: string | null = null;
      if (c.cadena_qr && (c.estado === "qr" || c.estado === "conectando")) {
        try {
          qr_png = await QRCode.toDataURL(c.cadena_qr, {
            width: 320,
            margin: 2,
            color: { dark: "#fafafa", light: "#0a0a0a" },
          });
        } catch {
          qr_png = null;
        }
      }
      return { ...c, bot_vivo: calcularBotVivo(c), qr_png };
    }),
  );
  return NextResponse.json({ cuentas: enriquecidas });
}

export async function POST(req: NextRequest) {
  let payload: {
    etiqueta?: unknown;
    prompt_sistema?: unknown;
    modelo?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const etiqueta =
    typeof payload.etiqueta === "string" ? payload.etiqueta.trim() : "";
  if (!etiqueta) {
    return NextResponse.json(
      { error: "El campo 'etiqueta' es obligatorio" },
      { status: 400 },
    );
  }

  const promptSistema =
    typeof payload.prompt_sistema === "string" ? payload.prompt_sistema : null;
  const modelo = typeof payload.modelo === "string" ? payload.modelo : null;

  const cuenta = crearCuenta(etiqueta, promptSistema, modelo);
  return NextResponse.json({ cuenta });
}
