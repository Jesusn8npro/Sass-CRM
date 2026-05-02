import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import {
  contarCuentasDeUsuario,
  crearCuenta,
  listarCuentas,
  obtenerUsuarioApp,
} from "@/lib/baseDatos";
import { arrancarBotEnProceso } from "@/lib/bot/cicloVida";
import { calcularBotVivo } from "@/lib/latidoBot";
import { requerirSesion } from "@/lib/auth/sesion";
import { obtenerPlan } from "@/lib/planes";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  // Fallback: si por algún motivo instrumentation no arrancó el bot,
  // lo arrancamos en la primera request al panel. arrancarBotEnProceso
  // es idempotente: llamadas repetidas no duplican intervals ni sockets.
  if (process.env.BOT_EN_PROCESO !== "0") {
    void arrancarBotEnProceso().catch((err) =>
      console.error("[api/cuentas] fallback arrancar bot:", err),
    );
  }
  const cuentas = await listarCuentas(auth.id);
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
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

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

  // Enforce de límite por plan: leemos el plan del usuario y comparamos
  // contra cuentas activas. Devolvemos 402 (Payment Required) cuando
  // hay que upgradear — el front muestra CTA al plan superior.
  const usuario = await obtenerUsuarioApp(auth.id);
  const plan = obtenerPlan(usuario?.plan);
  const usadas = await contarCuentasDeUsuario(auth.id);
  if (usadas >= plan.limite_cuentas) {
    return NextResponse.json(
      {
        error: `Llegaste al límite de ${plan.limite_cuentas} cuenta(s) del plan ${plan.nombre}. Actualizá a un plan superior para crear más.`,
        codigo: "limite_plan_alcanzado",
        plan_actual: plan.id,
        limite: plan.limite_cuentas,
        usadas,
      },
      { status: 402 },
    );
  }

  const cuenta = await crearCuenta(auth.id, etiqueta, promptSistema, modelo);
  return NextResponse.json({ cuenta });
}
