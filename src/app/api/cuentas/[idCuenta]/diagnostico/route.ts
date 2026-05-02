import { NextResponse, type NextRequest } from "next/server";
import { obtenerCuenta } from "@/lib/baseDatos";
import { requerirSesion } from "@/lib/auth/sesion";
import { resolverCredencialesVapi } from "@/lib/vapi-credenciales";
import { obtenerGestor } from "@/lib/baileys/gestor";
import { calcularBotVivo } from "@/lib/latidoBot";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ idCuenta: string }>;
}

/**
 * GET /api/cuentas/[idCuenta]/diagnostico
 *
 * Devuelve un chequeo completo de "por qué algo no funciona". Útil
 * cuando el bot no responde, no hace llamadas, o se desconecta seguido.
 *
 * No expone secretos — solo flags booleanos.
 */
export async function GET(_req: NextRequest, { params }: Contexto) {
  const auth = await requerirSesion();
  if (auth instanceof NextResponse) return auth;

  const { idCuenta } = await params;
  const cuenta = await obtenerCuenta(idCuenta);
  if (!cuenta || cuenta.usuario_id !== auth.id) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const cred = resolverCredencialesVapi(cuenta);
  const sock = obtenerGestor().obtenerSocket(idCuenta);
  const botVivo = calcularBotVivo(cuenta);

  const chequeos: Array<{
    ok: boolean;
    nombre: string;
    detalle: string;
    fix?: string;
  }> = [];

  // 1. OpenAI
  chequeos.push({
    ok: !!process.env.OPENAI_API_KEY,
    nombre: "OPENAI_API_KEY",
    detalle: process.env.OPENAI_API_KEY
      ? "configurada"
      : "no está en .env.local",
    fix: process.env.OPENAI_API_KEY
      ? undefined
      : "Pegá tu API key de OpenAI en .env.local y reiniciá el server.",
  });

  // 2. Cuenta WhatsApp activa
  chequeos.push({
    ok: cuenta.esta_activa && !cuenta.esta_archivada,
    nombre: "Cuenta WhatsApp activa",
    detalle: cuenta.esta_archivada
      ? "archivada"
      : !cuenta.esta_activa
      ? "marcada como inactiva"
      : "activa",
  });

  // 3. Estado de conexión Baileys
  chequeos.push({
    ok: cuenta.estado === "conectado",
    nombre: "Conectada a WhatsApp",
    detalle: `estado='${cuenta.estado}'${cuenta.telefono ? ` (+${cuenta.telefono})` : ""}`,
    fix:
      cuenta.estado !== "conectado"
        ? "Andá al panel y escaneá el QR para reconectar."
        : undefined,
  });

  // 4. Bot vivo (heartbeat reciente)
  chequeos.push({
    ok: botVivo,
    nombre: "Bot ejecutándose",
    detalle: botVivo
      ? `heartbeat reciente${cuenta.ultimo_heartbeat ? ` (${cuenta.ultimo_heartbeat}s)` : ""}`
      : "sin heartbeat — el proceso del bot puede no estar corriendo",
    fix: botVivo
      ? undefined
      : "Reiniciá `npm run dev`. Si persiste, hay un crash en el bot.",
  });

  // 5. Socket activo en gestor
  chequeos.push({
    ok: !!sock,
    nombre: "Socket Baileys activo",
    detalle: sock
      ? "socket en memoria, listo para enviar/recibir"
      : "no hay socket — el gestor no levantó la cuenta",
  });

  // 6. Vapi (informativo, no bloqueante)
  chequeos.push({
    ok: cred.apiKey !== null,
    nombre: "Vapi configurado",
    detalle: cred.apiKey
      ? `api_key: ${cred.origenApiKey}, phone: ${cred.origenPhoneId}`
      : "sin api_key (cuenta ni env) — llamadas no funcionarán",
  });

  // 7. ElevenLabs voz (informativo)
  const tieneVoz = !!cuenta.voz_elevenlabs?.trim();
  const tieneEleven = !!process.env.ELEVENLABS_API_KEY?.trim();
  chequeos.push({
    ok: tieneVoz && tieneEleven,
    nombre: "Voz ElevenLabs (TTS)",
    detalle:
      !tieneVoz && !tieneEleven
        ? "sin voice ID y sin API key — el bot solo responde texto"
        : !tieneVoz
        ? "API key OK pero sin voice_id en la cuenta — solo texto"
        : !tieneEleven
        ? "voice_id OK pero sin ELEVENLABS_API_KEY — solo texto"
        : "configurada — el bot puede responder con voz",
  });

  return NextResponse.json({
    cuenta: {
      id: cuenta.id,
      etiqueta: cuenta.etiqueta,
      estado: cuenta.estado,
      telefono: cuenta.telefono,
      modelo: cuenta.modelo,
    },
    chequeos,
    todo_ok: chequeos.every((c) => c.ok || c.nombre.includes("Vapi") || c.nombre.includes("Voz")),
  });
}
